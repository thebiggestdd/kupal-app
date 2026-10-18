// STEP A: DELETE OR REMOVE the old "import { createClient } ..." line completely from the top!

// STEP B: Use the direct universal initialization command instead:
const SUPABASE_URL = 'https://kqalrdrbondaohwxksol.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_ytEEU4fhyZzAyZ0yJdhMRA_QnZIwKCq';

// This grabs the tool directly from the HTML script injection layer!
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const photoInput = document.getElementById('photo-input');
const nameInput = document.getElementById('name-input');
const uploadBtn = document.getElementById('upload-btn');
const photoGallery = document.getElementById('photo-gallery');


// NEW INTERACTIVE TRIGGER: Update file text indicator instantly on click selection
photoInput.addEventListener('change', () => {
    if (photoInput.files.length > 0) {
        fileChosenText.innerText = photoInput.files[0].name; // Show file name (e.g. photo.jpg)
    } else {
        fileChosenText.innerText = "No file selected";
    }
});

// 2. FILE UPLOAD LOGIC
uploadBtn.addEventListener('click', async () => {
    const files = photoInput.files;
    
    if (files.length === 0) {
        alert('Pick a beautiful photo first before hitting upload! (BAYOOOTTT)');
        return;
    }

    if (!nameInput.value.trim()) {
        alert('Please write your name or username before sharing!');
        return;
    }

    const file = files[0]; 
    const uniqueFileName = `gallery_${Date.now()}_${file.name}`;

    try {
        uploadBtn.innerText = "Uploading...";
        uploadBtn.disabled = true;

        const { data: storageData, error: storageError } = await supabase.storage
            .from('photos')
            .upload(uniqueFileName, file);

        if (storageError) throw storageError;

        const { data: urlData } = supabase.storage
            .from('photos')
            .getPublicUrl(uniqueFileName);

        const publicUrl = urlData.publicUrl;

        // Save records with likes defaulting to 0 parameters
        const { data: dbData, error: dbError } = await supabase
            .from('user_inputs')
            .insert([
                { 
                    url: publicUrl, 
                    uploader_name: nameInput.value.trim(),
                    likes: 0
                }
            ]);

        if (dbError) throw dbError;

        photoInput.value = '';
        nameInput.value = ''; 
        fileChosenText.innerText = "No file selected"; // Reset file text display
        alert('Photo successfully shared with the barkada! 🚀');

    } catch (error) {
        console.error("Upload crashed:", error.message);
        alert('Upload failed! Check that your table is named "user_inputs" and RLS is off.');
    } finally {
        uploadBtn.innerText = "Upload";
        uploadBtn.disabled = false;
    }
});

// 3. NEW FEATURE: INCREMENT LIKE COUNTER VIA DATABASE QUERY
async function likePhoto(id, currentLikes) {
    try {
        const { error } = await supabase
            .from('user_inputs')
            .update({ likes: currentLikes + 1 })
            .eq('id', id);

        if (error) throw error;
        // The Realtime listener will catch this update and refresh your screen automatically!
    } catch (error) {
        console.error("Like interaction failed:", error.message);
    }
}

// 4. SECURE DELETION LOGIC
async function deletePhoto(id, imageUrl) {
    if (!confirm("Are you sure you want to delete this photo permanently?")) {
        return;
    }

    try {
        const filename = imageUrl.split('/').pop();

        const { error: dbError } = await supabase
            .from('user_inputs')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;

        const { error: storageError } = await supabase.storage
            .from('photos')
            .remove([filename]);

        if (storageError) throw storageError;

        alert('Photo cleared completely!');

    } catch (error) {
        console.error("Deletion crashed:", error.message);
        alert('Failed to completely delete the image asset.');
    }
}

// 5. RENDERING PHOTO CARDS (WITH LIKE BUTTON ATTACHED)
function displayImageInGrid(id, imageUrl, uploaderName, createdAt, likeCount) {
    const cardContainer = document.createElement('div');
    cardContainer.className = 'photo-card';
    cardContainer.id = `photo-${id}`;

    const newImage = document.createElement('img');
    newImage.src = imageUrl;
    newImage.alt = "Shared Memory Picture";

    const footerDataRow = document.createElement('div');
    footerDataRow.className = 'card-details-row';

    const metaGroup = document.createElement('div');
    metaGroup.className = 'text-meta-group';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'uploader-title';
    titleDiv.innerText = uploaderName;

    const uploadDate = new Date(createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'upload-timestamp';
    timestampDiv.innerText = `(${uploadDate})`;

    metaGroup.appendChild(titleDiv);
    metaGroup.appendChild(timestampDiv);

    // Dynamic Actions Sidebar Wrapper Container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'card-actions';

    // Generate Interaction Heart Button Node Element
    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn';
    likeBtn.innerText = `❤️ ${likeCount || 0}`;
    likeBtn.addEventListener('click', () => likePhoto(id, likeCount || 0));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'insta-delete-btn';
    deleteBtn.innerText = 'Delete';
    deleteBtn.addEventListener('click', () => deletePhoto(id, imageUrl));

    actionsContainer.appendChild(likeBtn);
    actionsContainer.appendChild(deleteBtn);

    footerDataRow.appendChild(metaGroup);
    footerDataRow.appendChild(actionsContainer);

    cardContainer.appendChild(newImage);
    cardContainer.appendChild(footerDataRow);

    photoGallery.insertBefore(cardContainer, photoGallery.firstChild);
}

// 6. READ DATA LOG CATALOG FROM SUPABASE TABLE
async function loadEntireGallery() {
    try {
        photoGallery.innerHTML = '';

        const { data, error } = await supabase
            .from('user_inputs')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {
            for (const record of data) {
                // Pass record.likes down into structural renderer function variables parameters
                displayImageInGrid(record.id, record.url, record.uploader_name, record.created_at, record.likes);
            }
        }
    } catch (error) {
        console.warn("Gallery load issue:", error.message);
    }
}

// 7. REALTIME STREAM BACKGROUND BROADCAST LISTENER
supabase
  .channel('live_user_inputs')
  .on(
    'postgres_changes', 
    { event: '*', schema: 'public', table: 'user_inputs' }, 
    (payload) => {
        console.log('Realtime shift detected:', payload);
        loadEntireGallery();
    }
  )
  .subscribe();

loadEntireGallery();

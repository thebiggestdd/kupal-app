import { createClient } from 'https://jsdelivr.net'

// 1. SUPABASE PROJECT CONNECTION SETTINGS
const SUPABASE_URL = 'https://kqalrdrbondaohwxksol.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_ytEEU4fhyZzAyZ0yJdhMRA_QnZIwKCq';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const photoInput = document.getElementById('photo-input');
const nameInput = document.getElementById('name-input');
const uploadBtn = document.getElementById('upload-btn');
const photoGallery = document.getElementById('photo-gallery');

// 2. FILE UPLOAD AND DATABASE SAVING LOGIC
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

        // Step A: Push raw file asset into the 'photos' storage bucket
        const { data: storageData, error: storageError } = await supabase.storage
            .from('photos')
            .upload(uniqueFileName, file);

        if (storageError) throw storageError;

        // Step B: Fetch the permanent public web URL link path string
        const { data: urlData } = supabase.storage
            .from('photos')
            .getPublicUrl(uniqueFileName);

        const publicUrl = urlData.publicUrl;

        // Step C: Log tracking rows directly inside your 'user_inputs' data table
        const { data: dbData, error: dbError } = await supabase
            .from('user_inputs')
            .insert([
                { 
                    url: publicUrl, 
                    uploader_name: nameInput.value.trim() 
                }
            ]);

        if (dbError) throw dbError;

        photoInput.value = '';
        nameInput.value = ''; 
        alert('Photo successfully shared with the barkada! 🚀');

    } catch (error) {
        console.error("Upload crashed:", error.message);
        alert('Upload failed! Check that your table is named "user_inputs" and RLS is off.');
    } finally {
        uploadBtn.innerText = "Upload";
        uploadBtn.disabled = false;
    }
});

// 3. SECURE ASSET AND RECORD DELETION LOGIC
async function deletePhoto(id, imageUrl) {
    if (!confirm("Are you sure you want to delete this photo permanently?")) {
        return;
    }

    try {
        const filename = imageUrl.split('/').pop();

        // Step A: Delete matching target tracking row index from database
        const { error: dbError } = await supabase
            .from('user_inputs')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;

        // Step B: Purge the actual file container from storage bucket directory
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

// 4. RENDERING PHOTO CARDS TO MATCH YOUR CANVA MOCKUP
function displayImageInGrid(id, imageUrl, uploaderName, createdAt) {
    // Create the outer card frame
    const cardContainer = document.createElement('div');
    cardContainer.className = 'photo-card';
    cardContainer.id = `photo-${id}`;

    // Generate the Image tag module
    const newImage = document.createElement('img');
    newImage.src = imageUrl;
    newImage.alt = "Shared Memory Picture";

    // Generate the footer metadata layout wrapper container row
    const footerDataRow = document.createElement('div');
    footerDataRow.className = 'card-details-row';

    // Group the text details elements together neatly
    const metaGroup = document.createElement('div');
    metaGroup.className = 'text-meta-group';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'uploader-title';
    titleDiv.innerText = uploaderName;

    // Convert date string parameters into human readable timestamps
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

    // Generate the custom deep blue pill deletion button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'insta-delete-btn';
    deleteBtn.innerText = 'Delete';
    deleteBtn.addEventListener('click', () => deletePhoto(id, imageUrl));

    // Compile all structural child nodes together in matching presentation layout hierarchy
    footerDataRow.appendChild(metaGroup);
    footerDataRow.appendChild(deleteBtn);

    cardContainer.appendChild(newImage);
    cardContainer.appendChild(footerDataRow);

    // Slide elements into layout view smoothly
    photoGallery.insertBefore(cardContainer, photoGallery.firstChild);
}

// 5. READ SYSTEM DATA LOG CATALOG FROM SUPABASE TABLE
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
                displayImageInGrid(record.id, record.url, record.uploader_name, record.created_at);
            }
        }
    } catch (error) {
        console.warn("Gallery load issue:", error.message);
    }
}

// 6. REALTIME STREAM BACKGROUND BROADCAST LISTENER
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

// Initial page startup loader execution pass
loadEntireGallery();


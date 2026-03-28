// Constants
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/gcmv4wbjo11gd';
// TODO: Replace with your actual ImgBB API key from https://api.imgbb.com/
const IMGBB_API_KEY = '08dee5a303e2964a53c6ff171668006b';

// DOM Elements
const form = document.getElementById('campForm');
const fileInput = document.getElementById('photo');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const fileDesign = document.getElementById('fileDesign');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.querySelector('.btn-text');
const submitLoader = document.getElementById('submitLoader');
const formMessage = document.getElementById('formMessage');
const successModal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModalBtn');

// Close Modal Event
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        successModal.style.display = 'none';
    });
}

// File Upload UI Interaction
fileInput.addEventListener('change', function (e) {
    if (this.files && this.files.length > 0) {
        fileNameDisplay.textContent = 'Selected: ' + this.files[0].name;
        fileDesign.style.borderColor = 'var(--primary-green)';
    } else {
        fileNameDisplay.textContent = '';
        fileDesign.style.borderColor = 'var(--border-color)';
    }
});

fileInput.addEventListener('dragenter', () => fileDesign.classList.add('drag-over'));
fileInput.addEventListener('dragleave', () => fileDesign.classList.remove('drag-over'));
fileInput.addEventListener('drop', () => fileDesign.classList.remove('drag-over'));

// Helper Function: Show Message
function showMessage(msg, type) {
    formMessage.textContent = msg;
    formMessage.className = `form-message ${type}`;
    formMessage.style.display = 'block';

    // Auto hide after 5 seconds
    setTimeout(() => {
        formMessage.style.display = 'none';
    }, 5000);
}

// Helper Function: Compress Image to make uploads instant
function compressImage(file, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    }));
                }, 'image/jpeg', 0.8); // 80% quality JPEG
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

// Helper Function: Upload Image to ImgBB
async function uploadImageToImgBB(file) {
    // We need to convert the file to a base64 string or send via FormData
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            return data.data.url; // Return the direct URL of the uploaded image
        } else {
            throw new Error(data.error.message || 'Image upload failed');
        }
    } catch (error) {
        console.error('ImgBB Error:', error);
        throw new Error('Failed to upload image. Please check your ImgBB API Key.');
    }
}

// Form Submission
form.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Prevent double submission
    if (submitBtn.disabled) return;

    // UI Loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    submitLoader.style.display = 'inline-block';
    formMessage.style.display = 'none';

    try {
        // 1. Gather form data
        const formData = new FormData(form);

        // Handle Checkboxes (multiple selections)
        const testsDone = formData.getAll('testType');
        const bloodGroupTested = testsDone.includes('Blood Group') ? 'Yes' : 'No';
        const sugarTested = testsDone.includes('Sugar Test') ? 'Yes' : 'No';

        // 2. Upload image first
        const photoFile = formData.get('photo');
        let photoUrl = '';

        if (photoFile && photoFile.size > 0) {
            if (IMGBB_API_KEY === 'YOUR_IMGBB_API_KEY') {
                throw new Error("Please add your ImgBB API Key in script.js to upload photos.");
            }
            // Compress Image to max 800x800 before upload to save time
            const compressedFile = await compressImage(photoFile, 800, 800);
            photoUrl = await uploadImageToImgBB(compressedFile);
        }

        // 3. Prepare payload for SheetDB
        // Keys must exactly match the column headers in your Google Sheet
        const payload = {
            data: {
                "Name": formData.get('name'),
                "Age": formData.get('age'),
                "Gender": formData.get('gender'),
                "BP": formData.get('bp'),
                "Weight": formData.get('weight'),
                "Contact": formData.get('contact'),
                "Address": formData.get('address'),
                "BloodGroup": bloodGroupTested,
                "SugarTest": sugarTested,
                "SerialNo": formData.get('serial'),
                "SamplePhoto": photoUrl,
                "Timestamp": new Date().toLocaleString()
            }
        };

        // 4. Send data to SheetDB
        const response = await fetch(SHEETDB_API_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            // Success
            if (successModal) successModal.style.display = 'flex';
            form.reset();
            fileNameDisplay.textContent = '';
        } else {
            // SheetDB error
            throw new Error(result.error || 'Failed to save data to sheet');
        }

    } catch (error) {
        // Error handling
        showMessage(error.message, 'error');
    } finally {
        // Reset UI Loading state
        submitBtn.disabled = false;
        btnText.style.display = 'inline-block';
        submitLoader.style.display = 'none';
    }
});

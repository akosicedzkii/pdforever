document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewList = document.getElementById('preview-list');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const convertBtn = document.getElementById('convert-btn');
    const uploadForm = document.getElementById('upload-form');
    const spinner = document.querySelector('.spinner');

    // Open file dialog when drop zone's label is clicked
    dropZone.addEventListener('click', (e) => {
        if (e.target.id === 'file-input-label') {
            fileInput.click();
        }
    });

    // Handle file selection
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFile(fileInput.files[0]);
        }
    });

    // Drag and drop for file upload
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragging');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragging');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragging');
        if (e.dataTransfer.files.length > 0) {
            // Assign the dropped file to the input
            fileInput.files = e.dataTransfer.files;
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Form submission
    uploadForm.addEventListener('submit', (e) => {
        if (fileInput.files.length === 0) {
            e.preventDefault();
            alert('Please select a file.');
            return;
        }
        // Show spinner and disable button
        convertBtn.disabled = true;
        spinner.style.display = 'inline-block';
    });

    function handleFile(file) {
        // Clear previous preview
        previewList.innerHTML = '';

        const li = document.createElement('li');
        li.className = 'preview-item';
        // Use a generic text for non-image files
        li.innerHTML = `<div class="file-name">${file.name}</div>`;
        previewList.appendChild(li);

        updateUI(true);
    }

    function updateUI(hasFile) {
        if (hasFile) {
            previewPlaceholder.style.display = 'none';
            convertBtn.disabled = false;
        } else {
            previewPlaceholder.style.display = 'block';
            convertBtn.disabled = true;
            previewList.innerHTML = '';
        }
    }
});


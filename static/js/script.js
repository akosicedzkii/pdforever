document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewList = document.getElementById('preview-list');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const convertBtn = document.getElementById('convert-btn');
    const uploadForm = document.getElementById('upload-form');
    const spinner = document.querySelector('.spinner');

    let filesMap = new Map();
    let draggedItem = null;

    // --- Event Listeners ---

    // Open file dialog when drop zone's label is clicked
    dropZone.addEventListener('click', (e) => {
        if (e.target.id === 'file-input-label') {
            fileInput.click();
        }
    });

    // Handle file selection
    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
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
        handleFiles(e.dataTransfer.files);
    });

    // Form submission
    uploadForm.addEventListener('submit', (e) => {
        if (filesMap.size === 0) {
            e.preventDefault();
            alert('Please select at least one image file.');
            return;
        }
        // Append the final file order to the form
        appendFileOrderToForm();
        
        // Show spinner and disable button
        convertBtn.disabled = true;
        spinner.style.display = 'inline-block';
    });

    // --- Core Functions ---

    function handleFiles(files) {
        for (const file of files) {
            if (file.type.startsWith('image/') && !filesMap.has(file.name)) {
                filesMap.set(file.name, file);
                createPreview(file);
            }
        }
        updateUI();
    }

    function createPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const li = document.createElement('li');
            li.className = 'preview-item';
            li.draggable = true;
            li.dataset.filename = file.name;

            li.innerHTML = `
                <img src="${e.target.result}" alt="${file.name}">
                <div class="file-name">${file.name}</div>
                <button type="button" class="remove-btn">&times;</button>
            `;

            previewList.appendChild(li);

            // Add event listeners for this new item
            li.querySelector('.remove-btn').addEventListener('click', () => removeFile(file.name));
            addDragEvents(li);
        };
        reader.readAsDataURL(file);
    }

    function removeFile(filename) {
        filesMap.delete(filename);
        const itemToRemove = previewList.querySelector(`[data-filename=""]`);
        if (itemToRemove) {
            previewList.removeChild(itemToRemove);
        }
        updateUI();
    }

    function updateUI() {
        if (filesMap.size > 0) {
            previewPlaceholder.style.display = 'none';
            convertBtn.disabled = false;
        } else {
            previewPlaceholder.style.display = 'block';
            convertBtn.disabled = true;
        }
    }

    // --- Drag and Drop for Reordering ---

    function addDragEvents(item) {
        item.addEventListener('dragstart', () => {
            draggedItem = item;
            setTimeout(() => item.classList.add('dragging-item'), 0);
        });

        item.addEventListener('dragend', () => {
            setTimeout(() => {
                draggedItem.classList.remove('dragging-item');
                draggedItem = null;
            }, 0);
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(previewList, e.clientY);
            if (afterElement == null) {
                previewList.appendChild(draggedItem);
            } else {
                previewList.insertBefore(draggedItem, afterElement);
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.preview-item:not(.dragging-item)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function appendFileOrderToForm() {
        // This function is key. It ensures the backend receives the files in the user-defined order.

        // Get the filenames in the current visual order.
        const orderedFilenames = [...previewList.querySelectorAll('.preview-item')].map(item => item.dataset.filename);

        // Use a DataTransfer object to create a new FileList in the correct order.
        const dataTransfer = new DataTransfer();

        orderedFilenames.forEach(filename => {
            if (filesMap.has(filename)) {
                // Add the file to our new FileList for submission
                dataTransfer.items.add(filesMap.get(filename));

                // Also create hidden inputs for the backend to confirm the order.
                const orderInput = document.createElement('input');
                orderInput.type = 'hidden';
                orderInput.name = 'file_order';
                orderInput.value = filename;
                uploadForm.appendChild(orderInput);
            }
        });

        // Replace the files in the file input with our newly created, sorted FileList.
        fileInput.files = dataTransfer.files;
    }
});

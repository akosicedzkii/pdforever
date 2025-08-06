import os
import uuid
import logging
import zipfile

import img2pdf
from pdf2image import convert_from_path
from flask import (Flask, request, render_template, send_file, flash,
                   redirect, url_for, after_this_request)
from werkzeug.utils import secure_filename

# --- Configuration ---
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS_IMG = {'png', 'jpg', 'jpeg', 'gif', 'tiff', 'bmp'}
ALLOWED_EXTENSIONS_PDF = {'pdf'}
ALLOWED_EXTENSIONS_DOC = {'doc', 'docx'}

MAX_CONTENT_LENGTH = 32 * 1024 * 1024  # 32 MB max upload size
POPPLER_PATH = "poppler-24.08.0\\Library\\bin" # e.g., "poppler-25.08.0\Library\bin"

# --- App Initialization ---
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['SECRET_KEY'] = os.urandom(24) # Secure secret key for flash messages
app.config['POPPLER_PATH'] = POPPLER_PATH

# --- Setup ---
# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# Setup basic logging
logging.basicConfig(level=logging.INFO)

def allowed_file(filename):
    """Checks if the file has an allowed extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS_IMG, ALLOWED_EXTENSIONS_PDF

@app.route('/')
def index():
    """Renders the main page."""
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert():
    """Handles file upload and conversion to PDF."""
    if 'images' not in request.files:
        flash('No file part in the request.')
        return redirect(request.url)

    files = request.files.getlist('images')

    if not files or all(f.filename == '' for f in files):
        flash('No files selected.')
        return redirect(url_for('index'))

    # Create a unique sub-directory for this request to avoid file conflicts
    session_id = str(uuid.uuid4())
    session_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
    os.makedirs(session_folder)

    image_paths = []
    # The order of files is determined by the 'file_order' form field from the frontend
    file_order = request.form.getlist('file_order')
    files_dict = {f.filename: f for f in files}

    sorted_files = [files_dict[filename] for filename in file_order if filename in files_dict]

    for file in sorted_files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(session_folder, filename)
            file.save(filepath)
            image_paths.append(filepath)
        else:
            # If any file is invalid, clean up and show an error
            flash(f"Invalid file type: {file.filename}. Allowed types are: {', '.join(ALLOWED_EXTENSIONS_IMG)}")
            cleanup_directory(session_folder)
            return redirect(url_for('index'))

    if not image_paths:
        flash('No valid image files were uploaded.')
        cleanup_directory(session_folder)
        return redirect(url_for('index'))

    # Convert images to PDF
    pdf_filename = f"pdforever_{session_id}.pdf"
    pdf_path = os.path.join(session_folder, pdf_filename)

    try:
        with open(pdf_path, "wb") as f:
            f.write(img2pdf.convert(image_paths))
        logging.info(f"Successfully created PDF: {pdf_path}")
    except Exception as e:
        logging.error(f"Error during PDF conversion: {e}")
        flash('An error occurred during PDF conversion.')
        cleanup_directory(session_folder)
        return redirect(url_for('index'))

    @after_this_request
    def cleanup(response):
        """Clean up the session folder after the request is complete."""
        cleanup_directory(session_folder)
        return response

    # Send the generated PDF to the user
    return send_file(
        pdf_path,
        as_attachment=True,
        download_name='converted_by_pdforever.pdf',
        mimetype='application/pdf'
    )
@app.route('/pdf-to-image', methods=['GET', 'POST'])
def pdf_to_image():
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file part in the request.')
            return redirect(request.url)
        file = request.files['file']
        if file.filename == '':
            flash('No file selected.')
            return redirect(request.url)

        if file and allowed_file(file.filename):
            session_id = str(uuid.uuid4())
            session_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
            os.makedirs(session_folder)

            filename = secure_filename(file.filename)
            pdf_path = os.path.join(session_folder, filename)
            file.save(pdf_path)

            try:
                # Convert PDF to a list of PIL images
                images = convert_from_path(pdf_path, poppler_path=app.config.get('POPPLER_PATH'))

                if not images:
                    flash('Could not extract any images from the PDF.')
                    cleanup_directory(session_folder)
                    return redirect(request.url)

                # Save images to a subfolder
                output_folder = os.path.join(session_folder, 'output_images')
                os.makedirs(output_folder)
                for i, image in enumerate(images):
                    image.save(os.path.join(output_folder, f'page_{i+1}.jpg'), 'JPEG')

                # Create a zip file of the images
                zip_path = os.path.join(session_folder, 'pdforever_images.zip')
                with zipfile.ZipFile(zip_path, 'w') as zipf:
                    for root, _, files in os.walk(output_folder):
                        for f in files:
                            zipf.write(os.path.join(root, f), arcname=f)

                @after_this_request
                def cleanup(response):
                    cleanup_directory(session_folder)
                    return response

                return send_file(
                    zip_path,
                    as_attachment=True,
                    download_name='pdforever_images.zip',
                    mimetype='application/zip'
                )

            except Exception as e:
                logging.error(f"Error during PDF to Image conversion: {e}")
                flash('An error occurred. Ensure Poppler is installed and its path is configured in app.py if needed.')
                cleanup_directory(session_folder)
                return redirect(request.url)
        else:
            flash(f"Invalid file type. Please upload a PDF.")
            return redirect(request.url)

    return render_template('pdf_to_image.html')

@app.route('/pdf-to-word')
def pdf_to_word():
    # NOTE: Reliable PDF to Word conversion is a very complex task.
    # Libraries like pdf2docx exist but may have limitations.
    # This is a placeholder for the UI.
    return render_template('pdf_to_word.html')

@app.route('/word-to-pdf')
def word_to_pdf():
    # NOTE: Word to PDF conversion often relies on external programs
    # like LibreOffice or Microsoft Word (via COM automation on Windows).
    # Libraries like docx2pdf can orchestrate this.
    # This is a placeholder for the UI.
    return render_template('word_to_pdf.html')

def cleanup_directory(path):
    """Removes a directory and all its contents."""
    import shutil
    try:
        shutil.rmtree(path)
        logging.info(f"Cleaned up session folder: {path}")
    except Exception as e:
        logging.error(f"Error cleaning up session folder {path}: {e}")

if __name__ == '__main__':
    app.run(debug=True)
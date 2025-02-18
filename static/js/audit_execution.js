// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    updateTaskCounters();
    initializeEventListeners();
    initializeReportGeneration();
    initializeCloneExecution();
    initializeDateHandling();
});

// Initialize date handling
function initializeDateHandling() {
    const today = new Date().toISOString().split('T')[0];
    
    // Set minimum date on all date inputs
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.setAttribute('min', today);
    });

    // Format displayed dates and check for overdue tasks
    document.querySelectorAll('.task-due-date').forEach(cell => {
        const date = cell.textContent.trim();
        if (date) {
            const dueDate = new Date(date);
            const formattedDate = dueDate.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            cell.textContent = formattedDate;

            // Check if task is overdue
            if (dueDate < new Date() && !cell.closest('tr').querySelector('.task-status .badge').textContent.includes('Completed')) {
                cell.classList.add('overdue');
            }
        }
    });
}

// Initialize event listeners
function initializeEventListeners() {
    // Event delegation for task actions
    document.addEventListener('click', function(event) {
        const target = event.target.closest('button');
        if (!target) return;

        if (target.classList.contains('edit-task')) {
            makeRowEditable(target.closest('tr'));
        } else if (target.classList.contains('delete-task')) {
            handleDeleteTask(target.closest('tr'));
        } else if (target.classList.contains('save-changes')) {
            saveChanges(target.closest('tr'));
        } else if (target.classList.contains('cancel-edit')) {
            cancelEdit(target.closest('tr'));
        }
    });

    // Handle generate procedures
    document.querySelectorAll('.generate-procedures').forEach(button => {
        button.addEventListener('click', handleGenerateProcedures);
    });

    // Handle add task
    document.querySelectorAll('.add-task').forEach(button => {
        button.addEventListener('click', handleAddTask);
    });
}

// Update these functions in your audit_execution.js file

function makeRowEditable(row) {
    const cells = row.querySelectorAll('td:not(:last-child)');
    const originalValues = {};

    cells.forEach(cell => {
        const className = Array.from(cell.classList).find(c => c.startsWith('task-'));
        if (className) {
            originalValues[className] = cell.innerHTML;

            if (className === 'task-status') {
                const currentStatus = cell.textContent.trim();
                cell.innerHTML = `
                    <select class="form-select form-select-sm">
                        <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="In Progress" ${currentStatus === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Completed" ${currentStatus === 'Completed' ? 'selected' : ''}>Completed</option>
                    </select>
                `;
            } else if (className === 'task-member') {
                const currentMember = cell.textContent.trim();
                const teamMembers = row.closest('.accordion-body').querySelectorAll('select[name="allocated_team_member"] option');
                let options = '<option value="">Select Team Member</option>';
                teamMembers.forEach(option => {
                    if (option.value) {
                        options += `<option value="${option.value}" ${option.value === currentMember ? 'selected' : ''}>${option.value}</option>`;
                    }
                });
                cell.innerHTML = `<select class="form-select form-select-sm">${options}</select>`;
            } else if (className === 'task-due-date') {
                const currentDate = cell.textContent.trim();
                let isoDate = '';
                if (currentDate) {
                    const [day, month, year] = currentDate.split('/');
                    isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }
                cell.innerHTML = `
                    <input type="date" class="form-control form-control-sm" 
                           value="${isoDate}" required>
                `;
            } else {
                cell.contentEditable = true;
                cell.classList.add('editing');
            }
        }
    });

    row.dataset.originalValues = JSON.stringify(originalValues);

    // Update action buttons
    const actionsCell = row.querySelector('td:last-child');
    actionsCell.innerHTML = `
        <div class="btn-group btn-group-sm">
            <button class="btn btn-success save-changes" title="Save">
                <i class="fas fa-check"></i>
            </button>
            <button class="btn btn-secondary cancel-edit" title="Cancel">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

async function saveChanges(row) {
    const taskId = row.getAttribute('data-task-id');
    const clientId = getClientIdFromUrl();
    const saveButton = row.querySelector('.save-changes');

    try {
        // Validate required fields
        const dueDate = row.querySelector('.task-due-date input').value;
        const taskName = row.querySelector('.task-name').textContent.trim();
        
        if (!dueDate || !taskName) {
            showToast('Error', 'Task name and due date are required');
            return;
        }

        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const updatedData = {
            task_name: taskName,
            procedure: row.querySelector('.task-procedure').textContent.trim(),
            audit_evidence: row.querySelector('.task-evidence').textContent.trim(),
            comments: row.querySelector('.task-comments').textContent.trim(),
            status: row.querySelector('.task-status select').value,
            allocated_team_member: row.querySelector('.task-member select').value,
            due_date: dueDate
        };

        const response = await fetch(`/client/${clientId}/update_audit_task/${taskId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });

        const data = await response.json();
        if (data.success) {
            showToast('Success', 'Changes saved successfully');
            
            // Update the row with new values
            row.querySelector('.task-name').textContent = updatedData.task_name;
            row.querySelector('.task-procedure').textContent = updatedData.procedure;
            row.querySelector('.task-evidence').textContent = updatedData.audit_evidence;
            row.querySelector('.task-comments').textContent = updatedData.comments;
            row.querySelector('.task-member').textContent = updatedData.allocated_team_member;
            
            // Format and update due date
            const formattedDate = new Date(updatedData.due_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            row.querySelector('.task-due-date').textContent = formattedDate;
            
            // Update status badge
            const statusCell = row.querySelector('.task-status');
            statusCell.innerHTML = `
                <span class="badge ${getStatusBadgeClass(updatedData.status)}">
                    ${updatedData.status}
                </span>
            `;

            // Update row styling based on status
            updateRowStatus(row, updatedData.status);
            
            // Restore action buttons
            restoreActionButtons(row);
            
            // Update counters
            updateTaskCounters();
        } else {
            throw new Error(data.message || 'Failed to save changes');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error', error.message || 'Failed to save changes');
    } finally {
        if (!error) {
            cancelEdit(row);
        } else {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-check"></i>';
        }
    }
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'Completed': return 'bg-success';
        case 'In Progress': return 'bg-warning';
        default: return 'bg-secondary';
    }
}

function updateRowStatus(row, status) {
    row.classList.remove('task-status-Completed', 'task-status-InProgress', 'task-status-Pending');
    row.classList.add(`task-status-${status.replace(' ', '')}`);
}

function restoreActionButtons(row) {
    const actionsCell = row.querySelector('td:last-child');
    actionsCell.innerHTML = `
        <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-primary edit-task" title="Edit Task">
                <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="btn btn-outline-danger delete-task" title="Delete Task">
                <i class="fas fa-trash"></i>
            </button>
            <button type="button" class="btn btn-outline-success upload-doc" 
                    title="Upload Document" 
                    onclick="openUploadModal('${row.getAttribute('data-task-id')}')">
                <i class="fas fa-file-upload"></i>
            </button>
        </div>
    `;
}

function cancelEdit(row) {
    try {
        const originalValues = JSON.parse(row.dataset.originalValues);
        const cells = row.querySelectorAll('td:not(:last-child)');

        cells.forEach(cell => {
            const className = Array.from(cell.classList).find(c => c.startsWith('task-'));
            if (className && originalValues[className]) {
                cell.innerHTML = originalValues[className];
                cell.contentEditable = false;
                cell.classList.remove('editing');
            }
        });

        restoreActionButtons(row);
    } catch (error) {
        console.error('Error restoring row:', error);
        location.reload();
    }
}
// Handle delete task
async function handleDeleteTask(row) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }

    const taskId = row.getAttribute('data-task-id');
    const clientId = getClientIdFromUrl();
    const deleteButton = row.querySelector('.delete-task');

    try {
        deleteButton.disabled = true;
        deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const response = await fetch(`/client/${clientId}/delete_audit_task/${taskId}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (data.success) {
            showToast('Success', 'Task deleted successfully');
            row.remove();
            updateTaskCounters();
        } else {
            throw new Error(data.message || 'Failed to delete task');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error', error.message || 'Failed to delete task');
        deleteButton.disabled = false;
        deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
    }
}

// Handle generate procedures
async function handleGenerateProcedures(event) {
    const button = event.currentTarget;
    const scopeArea = button.getAttribute('data-scope-area');
    const startDate = button.getAttribute('data-start-date');
    const endDate = button.getAttribute('data-end-date');
    const clientId = getClientIdFromUrl();

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        showToast('Info', 'Generating procedures...');

        const response = await fetch(
            `/client/${clientId}/generate_audit_procedure/${encodeURIComponent(scopeArea)}?start_date=${startDate}&end_date=${endDate}`,
            { method: 'POST' }
        );

        const data = await response.json();
        if (data.success) {
            showToast('Success', `Successfully generated ${data.count || ''} procedures!`);
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(data.error || 'Failed to generate procedures');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error', error.message || 'Failed to generate procedures');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-magic"></i> Generate Procedures';
    }
}

// Handle add task
async function handleAddTask() {
    const formId = this.getAttribute('data-form-id');
    const form = document.getElementById(formId);
    
    if (!form) {
        showToast('Error', 'Form not found');
        return;
    }

    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    try {
        const formData = new FormData(form);
        const clientId = getClientIdFromUrl();
        const startDate = formData.get('start_date');
        const endDate = formData.get('end_date');

        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

        const response = await fetch(
            `/client/${clientId}/add_audit_task?start_date=${startDate}&end_date=${endDate}`,
            {
                method: 'POST',
                body: formData
            }
        );

        const data = await response.json();
        if (data.success) {
            showToast('Success', 'Task added successfully!');
            const modal = bootstrap.Modal.getInstance(form.closest('.modal'));
            if (modal) {
                modal.hide();
            }
            location.reload();
        } else {
            throw new Error(data.error || 'Failed to add task');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error', error.message || 'Failed to add task');
    } finally {
        this.disabled = false;
        this.innerHTML = 'Add Task';
    }
}

// Document upload functions
function openUploadModal(taskId) {
    document.getElementById('taskIdForUpload').value = taskId;
    document.getElementById('selectedFiles').innerHTML = '';
    const fileInput = document.querySelector('#uploadDocForm input[type="file"]');
    fileInput.value = '';
    
    fileInput.addEventListener('change', updateFileList);
    
    const modal = new bootstrap.Modal(document.getElementById('uploadDocModal'));
    modal.show();
}

// Update file list preview
function updateFileList(event) {
    const files = event.target.files;
    const fileList = document.getElementById('selectedFiles');
    fileList.innerHTML = '';
    
    Array.from(files).forEach((file, index) => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'selected-file d-flex align-items-center mb-2 p-2 border rounded';
        
        const iconClass = getFileIconClass(file.type);
        const fileSize = formatFileSize(file.size);
        
        fileDiv.innerHTML = `
            <i class="fas ${iconClass} me-2"></i>
            <div class="flex-grow-1">
                <div class="fw-bold">${file.name}</div>
                <small class="text-muted">${getFileType(file.type)} - ${fileSize}</small>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        fileList.appendChild(fileDiv);
    });
}

// Remove file from selection
function removeFile(index) {
    const fileInput = document.querySelector('#uploadDocForm input[type="file"]');
    const dt = new DataTransfer();
    
    Array.from(fileInput.files).forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    fileInput.files = dt.files;
    updateFileList({ target: fileInput });
}

// Upload documents
async function uploadDocuments() {
    const form = document.getElementById('uploadDocForm');
    const formData = new FormData();
    const taskId = document.getElementById('taskIdForUpload').value;
    const clientId = getClientIdFromUrl();
    
    try {
        const uploadButton = document.querySelector('#uploadDocModal .btn-primary');
        uploadButton.disabled = true;
        uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

        formData.append('task_id', taskId);
        formData.append('doc_title', form.querySelector('[name="doc_title"]').value);
        formData.append('doc_description', form.querySelector('[name="doc_description"]').value);

        const files = form.querySelector('input[type="file"]').files;
        Array.from(files).forEach(file => {
            formData.append('documents', file);
        });

        const response = await fetch(`/client/${clientId}/task/${taskId}/upload-documents`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            showToast('Success', `${result.uploaded_count} documents uploaded successfully`);
            bootstrap.Modal.getInstance(document.getElementById('uploadDocModal')).hide();
            location.reload();
        } else {
            throw new Error(result.error || 'Failed to upload documents');
        }
    } catch (error) {
        showToast('Error', error.message);
    } finally {
        uploadButton.disabled = false;
        uploadButton.innerHTML = 'Upload';
    }
}

// Helper Functions
function getFileIconClass(mimeType) {
    const iconMap = {
        'application/pdf': 'fa-file-pdf',
        'application/msword': 'fa-file-word',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fa-file-word',
        'application/vnd.ms-excel': 'fa-file-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fa-file-excel',
        'image/': 'fa-file-image',
        'text/': 'fa-file-alt'
    };

    for (const [type, icon] of Object.entries(iconMap)) {
        if (mimeType.startsWith(type)) return icon;
    }
    return 'fa-file';
}

function getFileType(mimeType) {
    const typeMap = {
        'application/pdf': 'PDF',
        'application/msword': 'Word',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
        'application/vnd.ms-excel': 'Excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
        'image/jpeg': 'JPEG',
        'image/png': 'PNG',
        'text/plain': 'Text'
    };

    return typeMap[mimeType] || mimeType.split('/')[1].toUpperCase();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialize report generation
function initializeReportGeneration() {
    const reportModal = document.getElementById('generateReportModal');
    const downloadBtn = document.getElementById('downloadReport');
    
    if (reportModal) {
        reportModal.addEventListener('show.bs.modal', updateReportPreview);
        
        document.querySelectorAll('input[name="reportFormat"]').forEach(radio => {
            radio.addEventListener('change', updateReportPreview);
        });
        
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateReportPreview);
        });
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', generateAndDownloadReport);
        }
    }
}

// Update report preview
// Update the report preview when options change
function updateReportPreview() {
    const previewDiv = document.getElementById('reportPreview');
    const format = document.querySelector('input[name="reportFormat"]:checked').value;
    const includeSummary = document.getElementById('includeExecutiveSummary').checked;
    const includeFindings = document.getElementById('includeDetailedFindings').checked;
    const includeRecommendations = document.getElementById('includeRecommendations').checked;
    
    // Get statistics
    const stats = {
        total: document.getElementById('totalTasks')?.textContent || '0',
        completed: document.getElementById('completedTasks')?.textContent || '0',
        inProgress: document.getElementById('inProgressTasks')?.textContent || '0',
        pending: document.getElementById('pendingTasks')?.textContent || '0'
    };
    
    let previewContent = '<div class="preview-content">';
    
    // Add sections based on selected options
    if (includeSummary) {
        previewContent += generateExecutiveSummaryPreview(stats);
    }
    
    if (includeFindings) {
        previewContent += generateDetailedFindingsPreview();
    }
    
    if (includeRecommendations) {
        previewContent += generateRecommendationsPreview();
    }
    
    previewContent += '</div>';
    previewDiv.innerHTML = previewContent;
}

function generateExecutiveSummaryPreview(stats) {
    const completionRate = calculateCompletionRate(stats);
    return `
        <h4>Executive Summary</h4>
        <div class="mb-3">
            <p>Audit Execution Status:</p>
            <ul>
                <li>Total Tasks: ${stats.total}</li>
                <li>Completed: ${stats.completed}</li>
                <li>In Progress: ${stats.inProgress}</li>
                <li>Pending: ${stats.pending}</li>
            </ul>
            <p>Overall Completion Rate: ${completionRate}%</p>
        </div>
    `;
}

// Generate detailed findings preview
function generateDetailedFindingsPreview() {
    let findings = '<h4>Detailed Findings</h4><div class="mb-3">';
    
    // Get all task rows
    const taskRows = document.querySelectorAll('[data-task-id]');
    let hasFindingsContent = false;
    
    taskRows.forEach(row => {
        const status = row.querySelector('.task-status').textContent.trim();
        const taskName = row.querySelector('.task-name').textContent.trim();
        const evidence = row.querySelector('.task-evidence').textContent.trim();
        const comments = row.querySelector('.task-comments').textContent.trim();
        
        if (evidence || comments) {
            hasFindingsContent = true;
            findings += `
                <div class="finding-item mb-2 p-2 border-left border-primary">
                    <strong>${taskName}</strong> (${status})
                    ${evidence ? `<p class="mb-1"><strong>Evidence:</strong> ${evidence}</p>` : ''}
                    ${comments ? `<p class="mb-1"><strong>Comments:</strong> ${comments}</p>` : ''}
                </div>
            `;
        }
    });
    
    findings += hasFindingsContent ? '</div>' : '<p>No detailed findings available.</p></div>';
    return findings;
}

// Generate recommendations preview
function generateRecommendationsPreview() {
    let recommendations = `
        <h4>Recommendations</h4>
        <div class="mb-3">
            <p>Based on the audit execution status, the following recommendations are provided:</p>
            <ul>
    `;
    
    let hasRecommendations = false;
    
    document.querySelectorAll('[data-task-id]').forEach(row => {
        const status = row.querySelector('.task-status').textContent.trim();
        if (status !== 'Completed') {
            hasRecommendations = true;
            const taskName = row.querySelector('.task-name').textContent.trim();
            const evidence = row.querySelector('.task-evidence').textContent.trim();
            
            recommendations += `
                <li>
                    <strong>${taskName}:</strong> Complete the pending task
                    ${evidence ? ` and ensure documentation of evidence: "${evidence}"` : ''}
                </li>
            `;
        }
    });
    
    recommendations += '</ul>';
    
    if (!hasRecommendations) {
        recommendations += '<p>No specific recommendations at this time - all tasks are completed.</p>';
    }
    
    recommendations += '</div>';
    return recommendations;
}

// Calculate completion rate
function calculateCompletionRate(stats) {
    const total = parseInt(stats.total);
    const completed = parseInt(stats.completed);
    return total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
}

// Initialize report generation when document loads
document.addEventListener('DOMContentLoaded', function() {
    initializeReportGeneration();
});

// Initialize report generation functionality
function initializeReportGeneration() {
    const reportModal = document.getElementById('generateReportModal');
    const downloadBtn = document.getElementById('downloadReport');
    
    if (reportModal) {
        // Update preview when modal opens
        reportModal.addEventListener('show.bs.modal', updateReportPreview);
        
        // Update preview when format changes
        document.querySelectorAll('input[name="reportFormat"]').forEach(radio => {
            radio.addEventListener('change', updateReportPreview);
        });
        
        // Update preview when sections are toggled
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateReportPreview);
        });
        
        // Handle download button click
        if (downloadBtn) {
            downloadBtn.addEventListener('click', generateAndDownloadReport);
        }
    }
}

// Generate executive summary section
function generateExecutiveSummary(stats) {
    return `
        <h4>Executive Summary</h4>
        <div class="mb-3">
            <p>Audit Status Overview:</p>
            <ul>
                <li>Total Tasks: ${stats.total}</li>
                <li>Completed: ${stats.completed}</li>
                <li>In Progress: ${stats.inProgress}</li>
                <li>Pending: ${stats.pending}</li>
            </ul>
            <p>Completion Rate: ${calculateCompletionRate(stats)}%</p>
        </div>
    `;
}

// Generate detailed findings section
function generateDetailedFindings() {
    let findings = '<h4>Detailed Findings</h4><div class="mb-3">';
    
    document.querySelectorAll('[data-task-id]').forEach(row => {
        const status = row.querySelector('.task-status').textContent.trim();
        const taskName = row.querySelector('.task-name').textContent.trim();
        const comments = row.querySelector('.task-comments').textContent.trim();
        const evidence = row.querySelector('.task-evidence').textContent.trim();
        
        if (comments || evidence) {
            findings += `
                <div class="finding-item mb-2">
                    <strong>${taskName}</strong> (${status})
                    ${evidence ? `<p class="mb-1"><strong>Evidence:</strong> ${evidence}</p>` : ''}
                    ${comments ? `<p class="mb-0 text-muted">${comments}</p>` : ''}
                </div>
            `;
        }
    });
    
    findings += '</div>';
    return findings;
}

// Generate recommendations section
function generateRecommendations() {
    let recommendations = `
        <h4>Recommendations</h4>
        <div class="mb-3">
            <p>Based on the audit findings, the following recommendations are provided:</p>
            <ul>
    `;
    
    document.querySelectorAll('[data-task-id]').forEach(row => {
        const status = row.querySelector('.task-status').textContent.trim();
        if (status !== 'Completed') {
            const taskName = row.querySelector('.task-name').textContent.trim();
            const dueDate = row.querySelector('.task-due-date').textContent.trim();
            recommendations += `
                <li>
                    Complete the task "${taskName}" 
                    ${dueDate ? `(Due: ${dueDate})` : ''}
                </li>
            `;
        }
    });
    
    recommendations += '</ul></div>';
    return recommendations;
}

// Generate and download report
async function generateAndDownloadReport() {
    const downloadBtn = document.getElementById('downloadReport');
    const format = document.querySelector('input[name="reportFormat"]:checked').value;
    const clientId = getClientIdFromUrl();
    
    try {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating...';

        const { startDate, endDate } = getAuditPeriodDates();

        // Send request to the execution report endpoint
        const response = await fetch(`/client/${clientId}/generate_custom_report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                format: format,
                startDate: startDate,
                endDate: endDate
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate report');
        }

        // Handle successful response
        const blob = await response.blob();
        const fileName = `Audit_Execution_Report_${startDate}_to_${endDate}.${format === 'excel' ? 'xlsx' : 'docx'}`;
        
        // Create and trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Show success message
        showToast('Success', 'Report generated successfully!');

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('generateReportModal'));
        if (modal) {
            setTimeout(() => modal.hide(), 1000);
        }

    } catch (error) {
        console.error('Error generating report:', error);
        showToast('Error', error.message || 'Failed to generate report');
    } finally {
        // Reset button state
        const downloadBtn = document.getElementById('downloadReport');
        if (downloadBtn) {
            setTimeout(() => {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<i class="fas fa-download me-2"></i>Download Report';
            }, 2000);
        }
    }
}

// Helper function to get audit period dates from the UI
function getAuditPeriodDates() {
    const periodBanner = document.querySelector('.period-banner');
    if (!periodBanner) {
        throw new Error('Period banner not found');
    }

    const text = periodBanner.textContent;
    const startMatch = text.match(/Audit Period: (.*?) to/);
    const endMatch = text.match(/to (.*?)(?=\n|$)/);

    if (!startMatch || !endMatch) {
        throw new Error('Could not extract audit period dates');
    }

    return {
        startDate: startMatch[1].trim(),
        endDate: endMatch[1].trim()
    };
}


// Initialize clone execution functionality
function initializeCloneExecution() {
    const cloneModal = document.getElementById('cloneExecutionModal');
    const cloneForm = document.getElementById('cloneExecutionForm');
    const sourcePeriodSelect = document.getElementById('sourcePeriod');
    const newStartDateInput = document.getElementById('newStartDate');
    const newEndDateInput = document.getElementById('newEndDate');
    const cloneButton = document.getElementById('cloneExecutionBtn');

    if (sourcePeriodSelect) {
        sourcePeriodSelect.addEventListener('change', validateSourcePeriod);
    }

    if (newStartDateInput && newEndDateInput) {
        newStartDateInput.addEventListener('change', () => validateDates(newStartDateInput, newEndDateInput));
        newEndDateInput.addEventListener('change', () => validateDates(newStartDateInput, newEndDateInput));
    }

    if (cloneButton) {
        cloneButton.addEventListener('click', handleCloneExecution);
    }

    if (cloneModal) {
        cloneModal.addEventListener('hidden.bs.modal', () => {
            cloneForm.reset();
            if (cloneButton) {
                cloneButton.disabled = false;
                cloneButton.innerHTML = 'Clone Execution';
            }
        });
    }
}

// Handle clone execution
async function handleCloneExecution() {
    try {
        const sourcePeriodSelect = document.getElementById('sourcePeriod');
        const newStartDate = document.getElementById('newStartDate').value;
        const newEndDate = document.getElementById('newEndDate').value;

        if (!sourcePeriodSelect.value || !newStartDate || !newEndDate) {
            showToast('Error', 'Please fill in all required fields');
            return;
        }

        const [sourceStartDate, sourceEndDate] = sourcePeriodSelect.value.split('|');
        
        if (!validateDates(newStartDate, newEndDate)) {
            return;
        }

        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cloning...';

        const response = await fetch(`/client/${getClientIdFromUrl()}/clone_audit_execution`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source_start_date: sourceStartDate,
                source_end_date: sourceEndDate,
                new_start_date: newStartDate,
                new_end_date: newEndDate,
                overwrite: false
            })
        });

        const data = await response.json();

        if (data.requires_overwrite) {
            if (confirm('Audit execution already exists for this period. Do you want to overwrite it?')) {
                await handleOverwrite(sourceStartDate, sourceEndDate, newStartDate, newEndDate);
            } else {
                showToast('Info', 'Clone operation cancelled');
                this.disabled = false;
                this.innerHTML = 'Clone Execution';
            }
            return;
        }

        if (data.success) {
            handleCloneSuccess(newStartDate, newEndDate);
        } else {
            throw new Error(data.error || 'Failed to clone audit execution');
        }

    } catch (error) {
        console.error('Clone execution error:', error);
        showToast('Error', error.message || 'Failed to clone audit execution');
        this.disabled = false;
        this.innerHTML = 'Clone Execution';
    }
}

// Handle overwrite in clone operation
async function handleOverwrite(sourceStartDate, sourceEndDate, newStartDate, newEndDate) {
    try {
        const response = await fetch(`/client/${getClientIdFromUrl()}/clone_audit_execution`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source_start_date: sourceStartDate,
                source_end_date: sourceEndDate,
                new_start_date: newStartDate,
                new_end_date: newEndDate,
                overwrite: true
            })
        });

        const data = await response.json();
        if (data.success) {
            handleCloneSuccess(newStartDate, newEndDate);
        } else {
            throw new Error(data.error || 'Failed to overwrite audit execution');
        }
    } catch (error) {
        showToast('Error', error.message);
        throw error;
    }
}

// Handle successful clone operation
function handleCloneSuccess(newStartDate, newEndDate) {
    showToast('Success', 'Successfully cloned audit execution');
    const modal = bootstrap.Modal.getInstance(document.getElementById('cloneExecutionModal'));
    modal.hide();
    setTimeout(() => {
        window.location.href = `/client/${getClientIdFromUrl()}/audit_execution?start_date=${newStartDate}&end_date=${newEndDate}`;
    }, 1500);
}

// Utility Functions
function getClientIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    const clientIndex = pathParts.indexOf('client') + 1;
    if (clientIndex > 0 && clientIndex < pathParts.length) {
        return pathParts[clientIndex];
    }
    throw new Error('Client ID not found in URL');
}

function getAuditPeriodDates() {
    const periodBanner = document.querySelector('.period-banner');
    if (!periodBanner) {
        throw new Error('Period banner not found');
    }

    const text = periodBanner.textContent;
    const startMatch = text.match(/Audit Period: (.*?) to/);
    const endMatch = text.match(/to (.*?)(?=\n|$)/);

    if (!startMatch || !endMatch) {
        throw new Error('Could not extract audit period dates');
    }

    return {
        startDate: startMatch[1].trim(),
        endDate: endMatch[1].trim()
    };
}

function validateDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
        showToast('Error', 'End date must be after start date');
        return false;
    }
    return true;
}

function validateSourcePeriod(event) {
    if (!event.target.value) return;

    const [startDate, endDate] = event.target.value.split('|');
    const currentStart = document.querySelector('.period-banner').textContent.match(/Audit Period: (.*?) to/)[1].trim();
    const currentEnd = document.querySelector('.period-banner').textContent.match(/to (.*?)(?=\n|$)/)[1].trim();
    
    if (startDate === currentStart && endDate === currentEnd) {
        showToast('Warning', 'Cannot clone from current period');
        event.target.value = '';
    }
}

function calculateCompletionRate(stats) {
    const total = parseInt(stats.total);
    const completed = parseInt(stats.completed);
    return total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
}

function showToast(title, message) {
    const toast = document.getElementById('notificationToast');
    if (!toast) {
        console.error('Toast element not found');
        return;
    }

    const toastInstance = new bootstrap.Toast(toast, {
        delay: 3000
    });

    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastMessage').textContent = message;
    toastInstance.show();
}

function updateTaskCounters() {
    const counters = {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0
    };

    document.querySelectorAll('[data-task-id]').forEach(row => {
        counters.total++;
        const status = row.querySelector('.task-status').textContent.trim();
        
        if (status === 'Completed') counters.completed++;
        else if (status === 'In Progress') counters.inProgress++;
        else counters.pending++;
    });

    Object.entries(counters).forEach(([key, value]) => {
        const element = document.getElementById(`${key}Tasks`);
        if (element) element.textContent = value;
    });
}
// Function to view documents for a task
async function viewDocuments(taskId) {
    try {
        const clientId = getClientIdFromUrl();
        const response = await fetch(`/client/${clientId}/task/${taskId}/documents`);
        const data = await response.json();

        if (data.success) {
            const tableBody = document.querySelector('#docsTable tbody');
            tableBody.innerHTML = '';

            data.documents.forEach(doc => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${doc.title || doc.filename}</td>
                    <td>${getFileTypeLabel(doc.mime_type)}</td>
                    <td>${formatFileSize(doc.size)}</td>
                    <td>${doc.description || '-'}</td>
                    <td>${formatDate(doc.uploaded_at)}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <a href="/client/${clientId}/task-document/${doc._id}/download" 
                               class="btn btn-outline-primary" title="Download">
                                <i class="fas fa-download"></i>
                            </a>
                            <button type="button" class="btn btn-outline-danger"
                                    onclick="deleteDocument('${doc._id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tableBody.appendChild(row);
            });

            // Store current task ID for upload functionality
            document.getElementById('taskIdForUpload').value = taskId;

            // Show the modal
            const modal = new bootstrap.Modal(document.getElementById('viewDocsModal'));
            modal.show();
        } else {
            throw new Error(data.error || 'Failed to fetch documents');
        }
    } catch (error) {
        console.error('Error viewing documents:', error);
        showToast('Error', error.message || 'Failed to load documents');
    }
}

// Function to delete a document
async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }

    try {
        const clientId = getClientIdFromUrl();
        const response = await fetch(`/client/${clientId}/task-document/${docId}/delete`, {
            method: 'POST'
        });

        const data = await response.json();
        if (data.success) {
            showToast('Success', 'Document deleted successfully');
            // Refresh the documents list
            viewDocuments(document.getElementById('taskIdForUpload').value);
        } else {
            throw new Error(data.error || 'Failed to delete document');
        }
    } catch (error) {
        console.error('Error deleting document:', error);
        showToast('Error', error.message || 'Failed to delete document');
    }
}

// Function to format file type label
function getFileTypeLabel(mimeType) {
    const typeMap = {
        'application/pdf': '<i class="fas fa-file-pdf text-danger"></i> PDF',
        'application/msword': '<i class="fas fa-file-word text-primary"></i> DOC',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 
            '<i class="fas fa-file-word text-primary"></i> DOCX',
        'application/vnd.ms-excel': '<i class="fas fa-file-excel text-success"></i> XLS',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 
            '<i class="fas fa-file-excel text-success"></i> XLSX',
        'image/jpeg': '<i class="fas fa-file-image text-warning"></i> JPEG',
        'image/png': '<i class="fas fa-file-image text-warning"></i> PNG'
    };

    return typeMap[mimeType] || `<i class="fas fa-file"></i> ${mimeType.split('/')[1].toUpperCase()}`;
}

// Function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Function to upload more documents
function uploadMoreDocuments() {
    const taskId = document.getElementById('taskIdForUpload').value;
    const viewDocsModal = bootstrap.Modal.getInstance(document.getElementById('viewDocsModal'));
    viewDocsModal.hide();
    openUploadModal(taskId);
}

// Update the task row after document upload
function updateTaskDocuments(taskId, documentCount) {
    const taskRow = document.querySelector(`tr[data-task-id="${taskId}"]`);
    if (taskRow) {
        const actionsCell = taskRow.querySelector('td:last-child');
        const btnGroup = actionsCell.querySelector('.btn-group');
        
        // Update or add the view documents button
        let viewDocsBtn = btnGroup.querySelector('.view-docs');
        if (!viewDocsBtn) {
            viewDocsBtn = document.createElement('button');
            viewDocsBtn.className = 'btn btn-outline-info view-docs';
            viewDocsBtn.title = 'View Documents';
            viewDocsBtn.onclick = () => viewDocuments(taskId);
            btnGroup.appendChild(viewDocsBtn);
        }
        
        viewDocsBtn.innerHTML = `
            <i class="fas fa-folder-open"></i>
            <span class="badge bg-secondary">${documentCount}</span>
        `;
    }
}
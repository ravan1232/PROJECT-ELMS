import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { 
  Calendar, 
  FileText, 
  PlusCircle, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Download, 
  RefreshCw, 
  LogOut, 
  User,
  Paperclip
} from 'lucide-react';

export default function EmployeeDashboard({ token, user, onLogout, addToast }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Form State
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [document, setDocument] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  const fileInputRef = useRef(null);

  // Stats calculation
  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'Pending').length,
    approved: leaves.filter(l => l.status === 'Approved').length,
    rejected: leaves.filter(l => l.status === 'Rejected').length,
  };

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/leaves/employee`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch leave history');
      const data = await response.json();
      setLeaves(data);
    } catch (err) {
      addToast('Error', err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Poll for notifications
  const checkNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/leaves/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.length > 0) {
        data.forEach(notification => {
          const type = notification.status === 'Approved' ? 'success' : 'danger';
          const title = `Leave Request ${notification.status}`;
          const message = `Your request from ${notification.start_date} to ${notification.end_date} has been ${notification.status.toLowerCase()}. Remarks: "${notification.manager_remarks || 'None'}"`;
          addToast(title, message, type);
        });
        // Refresh the list to show updated status
        fetchLeaves();
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchLeaves();
    
    // Check notifications immediately, then poll every 10 seconds
    checkNotifications();
    const interval = setInterval(checkNotifications, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        addToast('File too large', 'Maximum file size is 5MB', 'danger');
        e.target.value = null;
        setDocument(null);
      } else {
        setDocument(file);
      }
    }
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!reason || !startDate || !endDate) {
      addToast('Validation Error', 'Please fill in all required fields', 'danger');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      addToast('Validation Error', 'Start date cannot be after end date', 'danger');
      return;
    }

    setSubmitLoading(true);

    const formData = new FormData();
    formData.append('reason', reason);
    formData.append('start_date', startDate);
    formData.append('end_date', endDate);
    if (document) {
      formData.append('document', document);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/leaves/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit leave request');
      }

      addToast('Application Submitted', 'Your leave request is now pending approval', 'success');
      
      // Reset form
      setReason('');
      setStartDate('');
      setEndDate('');
      setDocument(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      setShowApplyModal(false);
      fetchLeaves();
    } catch (err) {
      addToast('Submission Error', err.message, 'danger');
    } finally {
      setSubmitLoading(false);
    }
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return '';
    const startD = new Date(start + 'T00:00:00');
    const endD = new Date(end + 'T00:00:00');
    const diffTime = Math.abs(endD - startD);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
  };

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <Calendar size={22} style={{ color: '#8b5cf6' }} />
          <span>LeaveSync</span>
        </div>
        <div className="navbar-user">
          <div className="user-tag" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={16} style={{ marginTop: '2px' }} />
            <span>{user.username}</span>
          </div>
          <button id="logout-btn" className="btn btn-secondary" style={{ padding: '0.45rem 1rem', display: 'flex', gap: '0.4rem', fontSize: '0.85rem' }} onClick={onLogout}>
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {/* Welcome Section */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>Welcome Back, {user.username.split('@')[0]}!</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Manage your leave applications and check real-time status updates.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              id="refresh-leaves-btn"
              className="btn btn-secondary" 
              style={{ display: 'flex', gap: '0.5rem' }} 
              onClick={fetchLeaves}
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? 'spin-animation' : ''} />
              <span>Refresh</span>
            </button>
            <button 
              id="apply-leave-trigger"
              className="btn btn-primary" 
              style={{ display: 'flex', gap: '0.5rem' }} 
              onClick={() => setShowApplyModal(true)}
            >
              <PlusCircle size={18} />
              <span>Apply Leave</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
              <FileText size={24} />
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Applications</div>
              <div id="stat-total" style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{stats.total}</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--status-pending-bg)', color: 'var(--status-pending)' }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Pending Requests</div>
              <div id="stat-pending" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--status-pending)' }}>{stats.pending}</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--status-approved-bg)', color: 'var(--status-approved)' }}>
              <CheckCircle size={24} />
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Approved Requests</div>
              <div id="stat-approved" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--status-approved)' }}>{stats.approved}</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--status-rejected-bg)', color: 'var(--status-rejected)' }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Rejected Requests</div>
              <div id="stat-rejected" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--status-rejected)' }}>{stats.rejected}</div>
            </div>
          </div>
        </div>

        {/* Leave History Section */}
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.25rem', fontFamily: 'var(--font-display)' }}>Leave History</h2>
        
        {loading && leaves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading history...</div>
        ) : leaves.length === 0 ? (
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>No leave applications found</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
              You haven't submitted any leave requests yet. Apply for a leave to see your records here.
            </p>
            <button className="btn btn-primary" onClick={() => setShowApplyModal(true)}>
              Apply For Leave
            </button>
          </div>
        ) : (
          <div className="table-container glass-card">
            <table>
              <thead>
                <tr>
                  <th>Leave Dates & Duration</th>
                  <th>Reason</th>
                  <th>Supporting Document</th>
                  <th>Status</th>
                  <th>Manager Remarks</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>
                      <div style={{ fontWeight: '550' }}>
                        {leave.start_date} to {leave.end_date}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <Clock size={12} />
                        {calculateDuration(leave.start_date, leave.end_date)}
                      </div>
                    </td>
                    <td style={{ maxWidth: '300px', wordWrap: 'break-word', fontSize: '0.92rem' }}>
                      {leave.reason}
                    </td>
                    <td>
                      {leave.document_path ? (
                        <a 
                          href={`${API_BASE_URL}${leave.document_path}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}
                        >
                          <Download size={12} />
                          <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {leave.document_name}
                          </span>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No document</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${leave.status.toLowerCase()}`}>
                        {leave.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: '250px', wordWrap: 'break-word', fontSize: '0.9rem', color: leave.manager_remarks ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: leave.manager_remarks ? 'normal' : 'italic' }}>
                      {leave.manager_remarks || 'Pending review'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <div className="modal-header">
              <h2 className="modal-title">Apply for Leave</h2>
              <button className="modal-close" onClick={() => setShowApplyModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleApplySubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="start-date">Start Date</label>
                  <input
                    id="start-date"
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    disabled={submitLoading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="end-date">End Date</label>
                  <input
                    id="end-date"
                    type="date"
                    className="form-control"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    disabled={submitLoading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="leave-reason">Reason for Leave</label>
                <textarea
                  id="leave-reason"
                  className="form-control"
                  rows="3"
                  placeholder="Explain why you are taking leave..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  disabled={submitLoading}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label className="form-label" htmlFor="leave-document">Supporting Document (Optional)</label>
                <div style={{
                  border: '2px dashed var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.01)',
                  cursor: 'pointer',
                  position: 'relative'
                }} onClick={() => fileInputRef.current.click()}>
                  <input
                    id="leave-document"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={submitLoading}
                  />
                  <Paperclip size={24} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                  {document ? (
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>{document.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        {(document.size / 1024 / 1024).toFixed(2)} MB (Click to change)
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Click to select a document</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        Supports PDF, PNG, JPG (Max 5MB)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowApplyModal(false)}
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button 
                  id="submit-leave-btn"
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Spinner animation keyframes embedded */}
      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

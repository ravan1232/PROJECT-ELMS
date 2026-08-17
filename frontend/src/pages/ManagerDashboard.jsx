import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { 
  Calendar, 
  FileText, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Download, 
  RefreshCw, 
  LogOut,
  User,
  MessageSquare,
  Eye,
  Check,
  X
} from 'lucide-react';

export default function ManagerDashboard({ token, user, onLogout, addToast }) {
  const [activeTab, setActiveTab] = useState('leaves'); // 'leaves' or 'employees'
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');

  // Modal/Review State
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchLeaves = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/manager/leaves`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch leave requests');
      const data = await response.json();
      setLeaves(data);
    } catch (err) {
      addToast('Error', err.message, 'danger');
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/manager/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch employee list');
      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      addToast('Error', err.message, 'danger');
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchLeaves(), fetchEmployees()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReviewSubmit = async (status) => {
    if (!selectedLeave) return;

    setReviewLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/manager/leaves/${selectedLeave.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          manager_remarks: remarks
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update leave status');
      }

      addToast('Success', `Leave request has been ${status.toLowerCase()}`, 'success');
      setSelectedLeave(null);
      setRemarks('');
      loadData();
    } catch (err) {
      addToast('Review Failed', err.message, 'danger');
    } finally {
      setReviewLoading(false);
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

  const filteredLeaves = filterStatus === 'All' 
    ? leaves 
    : leaves.filter(l => l.status === filterStatus);

  // General metrics
  const pendingRequestsCount = leaves.filter(l => l.status === 'Pending').length;
  const approvedRequestsCount = leaves.filter(l => l.status === 'Approved').length;
  const totalEmployeesCount = employees.length;

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <Calendar size={22} style={{ color: '#8b5cf6' }} />
          <span>LeaveSync Portal</span>
          <span style={{ fontSize: '0.75rem', background: 'rgba(139, 92, 246, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#a78bfa', marginLeft: '0.5rem' }}>
            MANAGER
          </span>
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
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>Manager Operations Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Review pending leave requests, check employee records, and finalize decisions.</p>
          </div>
          <button 
            id="refresh-portal-btn"
            className="btn btn-secondary" 
            style={{ display: 'flex', gap: '0.5rem' }} 
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'spin-animation' : ''} />
            <span>Sync Data</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--status-pending-bg)', color: 'var(--status-pending)' }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Pending Approvals</div>
              <div id="manager-pending-stat" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--status-pending)' }}>{pendingRequestsCount}</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--status-approved-bg)', color: 'var(--status-approved)' }}>
              <CheckCircle size={24} />
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Approved Applications</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--status-approved)' }}>{approvedRequestsCount}</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Registered Employees</div>
              <div id="manager-employees-stat" style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{totalEmployeesCount}</div>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-glass)',
          marginBottom: '1.5rem',
          gap: '1.5rem'
        }}>
          <button 
            id="tab-leaves"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'leaves' ? '2px solid #8b5cf6' : '2px solid transparent',
              color: activeTab === 'leaves' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-display)',
              fontWeight: '600',
              fontSize: '1.05rem',
              padding: '0.75rem 0.5rem',
              cursor: 'pointer',
              transition: 'var(--transition-all)'
            }}
            onClick={() => setActiveTab('leaves')}
          >
            Leave Requests
          </button>
          <button 
            id="tab-employees"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'employees' ? '2px solid #8b5cf6' : '2px solid transparent',
              color: activeTab === 'employees' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-display)',
              fontWeight: '600',
              fontSize: '1.05rem',
              padding: '0.75rem 0.5rem',
              cursor: 'pointer',
              transition: 'var(--transition-all)'
            }}
            onClick={() => setActiveTab('employees')}
          >
            Registered Employees
          </button>
        </div>

        {/* --- LEAVES TAB PANEL --- */}
        {activeTab === 'leaves' && (
          <div>
            {/* Filtering bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <h2 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-display)' }}>Manage Applications</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Filter Status:</span>
                <select 
                  id="filter-status-select"
                  className="form-control" 
                  style={{ width: '160px', padding: '0.45rem 0.75rem', fontSize: '0.875rem' }}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            {loading && leaves.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>Syncing requests...</div>
            ) : filteredLeaves.length === 0 ? (
              <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <h3>No leave requests found</h3>
                <p style={{ color: 'var(--text-secondary)' }}>There are no leave requests matching the "{filterStatus}" filter.</p>
              </div>
            ) : (
              <div className="table-container glass-card">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Dates & Duration</th>
                      <th>Reason</th>
                      <th>Supporting Document</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaves.map((leave) => (
                      <tr key={leave.id}>
                        <td>
                          <div style={{ fontWeight: '550' }}>{leave.username}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{leave.user_id}</div>
                        </td>
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
                        <td>
                          {leave.status === 'Pending' ? (
                            <button 
                              className="btn btn-primary review-request-btn"
                              style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              onClick={() => {
                                setSelectedLeave(leave);
                                setRemarks('');
                              }}
                            >
                              <Eye size={12} />
                              <span>Review</span>
                            </button>
                          ) : (
                            <button 
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              onClick={() => {
                                setSelectedLeave(leave);
                                setRemarks(leave.manager_remarks || '');
                              }}
                            >
                              <span>View Decision</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- EMPLOYEES TAB PANEL --- */}
        {activeTab === 'employees' && (
          <div>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '1.25rem', fontFamily: 'var(--font-display)' }}>Registered Employee Directory</h2>
            
            {loading && employees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>Syncing directories...</div>
            ) : employees.length === 0 ? (
              <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <h3>No employees registered</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Currently, no employee accounts have registered on the platform.</p>
              </div>
            ) : (
              <div className="table-container glass-card">
                <table>
                  <thead>
                    <tr>
                      <th>Employee Username</th>
                      <th>Date Joined</th>
                      <th>Total Leaves</th>
                      <th>Approved</th>
                      <th>Pending</th>
                      <th>Rejected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id}>
                        <td>
                          <div style={{ fontWeight: '550', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                              {emp.username.charAt(0).toUpperCase()}
                            </div>
                            <span>{emp.username}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {new Date(emp.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                        </td>
                        <td style={{ fontWeight: '600' }}>{emp.total_leaves}</td>
                        <td style={{ color: 'var(--status-approved)', fontWeight: '600' }}>{emp.approved_leaves}</td>
                        <td style={{ color: 'var(--status-pending)', fontWeight: '600' }}>{emp.pending_leaves}</td>
                        <td style={{ color: 'var(--status-rejected)', fontWeight: '600' }}>{emp.rejected_leaves}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Review Modal */}
      {selectedLeave && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {selectedLeave.status === 'Pending' ? 'Review Leave Request' : 'Leave Decision Details'}
              </h2>
              <button className="modal-close" onClick={() => setSelectedLeave(null)}>&times;</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '0.2rem' }}>Employee</label>
                <div style={{ fontSize: '0.95rem', fontWeight: '550' }}>{selectedLeave.username}</div>
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: '0.2rem' }}>Leave Dates</label>
                <div style={{ fontSize: '0.95rem', fontWeight: '550' }}>
                  {selectedLeave.start_date} to {selectedLeave.end_date}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  ({calculateDuration(selectedLeave.start_date, selectedLeave.end_date)})
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '0.2rem' }}>Reason for Leave</label>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                fontSize: '0.95rem',
                color: 'var(--text-primary)',
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                {selectedLeave.reason}
              </div>
            </div>

            {selectedLeave.document_path && (
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '0.2rem' }}>Supporting Document</label>
                <div>
                  <a 
                    href={`${API_BASE_URL}${selectedLeave.document_path}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{
                      padding: '0.45rem 1rem',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Download size={14} />
                    <span>Download {selectedLeave.document_name}</span>
                  </a>
                </div>
              </div>
            )}

            <hr style={{ border: 'none', borderBottom: '1px solid var(--border-glass)', margin: '1.5rem 0' }} />

            {selectedLeave.status === 'Pending' ? (
              <div>
                <div className="form-group">
                  <label className="form-label" htmlFor="manager-remarks-input">Manager Remarks (Optional)</label>
                  <textarea
                    id="manager-remarks-input"
                    className="form-control"
                    rows="3"
                    placeholder="Enter approval/rejection remarks here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    disabled={reviewLoading}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setSelectedLeave(null)}
                    disabled={reviewLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    id="reject-leave-btn"
                    type="button" 
                    className="btn btn-danger"
                    style={{ display: 'flex', gap: '0.4rem' }}
                    onClick={() => handleReviewSubmit('Rejected')}
                    disabled={reviewLoading}
                  >
                    <X size={16} />
                    <span>Reject</span>
                  </button>
                  <button 
                    id="approve-leave-btn"
                    type="button" 
                    className="btn btn-success"
                    style={{ display: 'flex', gap: '0.4rem' }}
                    onClick={() => handleReviewSubmit('Approved')}
                    disabled={reviewLoading}
                  >
                    <Check size={16} />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label className="form-label">Review Status</label>
                  <div>
                    <span className={`badge badge-${selectedLeave.status.toLowerCase()}`}>
                      {selectedLeave.status}
                    </span>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Remarks</label>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    fontSize: '0.92rem',
                    color: selectedLeave.manager_remarks ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontStyle: selectedLeave.manager_remarks ? 'normal' : 'italic'
                  }}>
                    {selectedLeave.manager_remarks || 'No remarks entered.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spinner animation keyframes */}
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

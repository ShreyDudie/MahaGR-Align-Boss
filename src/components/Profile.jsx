import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Edit, Lock, Save, X, XCircle } from 'lucide-react';
import './Profile.css';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: ''
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [saving, setSaving] = useState(false);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      updateUser({
        ...user,
        name: editForm.fullName,
        email: editForm.email
      });
      setIsEditing(false);
      setSaving(false);
    }, 500);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordModal(false);
      setSaving(false);
      alert('Password updated successfully!');
    }, 500);
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="breadcrumb">
        <NavLink to="/" className="breadcrumb-link">Dashboard</NavLink>
        <span className="breadcrumb-separator">&gt;</span>
        <span className="breadcrumb-current">Profile</span>
      </div>

      <h2 className="page-title">My Profile</h2>

      <div className="profile-card">
        {/* Compact Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">
            <span className="avatar-initial">{user.name.charAt(0)}</span>
          </div>
          <div className="profile-basic-info">
            <h3 className="profile-name">{user.name}</h3>
            <div className="profile-role-badge">{user.role.replace('_', ' ').toUpperCase()}</div>
            <p className="profile-department">{user.department || 'Administration'}</p>
          </div>
        </div>

        <div className="profile-divider"></div>

        {/* Employee Information Section */}
        <div className="section-header">
          <h4 className="section-title">Employee Information</h4>
        </div>

        <div className="info-grid">
          <div className="info-row">
            <span className="info-label">Full Name</span>
            <span className="info-separator">:</span>
            {isEditing ? (
              <input
                type="text"
                className="info-input"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            ) : (
              <span className="info-value">{user.name}</span>
            )}
          </div>

          <div className="info-row">
            <span className="info-label">Employee ID</span>
            <span className="info-separator">:</span>
            <span className="info-value">{user.id || 'N/A'}</span>
          </div>

          <div className="info-row">
            <span className="info-label">Email Address</span>
            <span className="info-separator">:</span>
            {isEditing ? (
              <input
                type="email"
                className="info-input"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            ) : (
              <span className="info-value">{user.email}</span>
            )}
          </div>

          <div className="info-row">
            <span className="info-label">Department</span>
            <span className="info-separator">:</span>
            <span className="info-value">{user.department || 'Administration'}</span>
          </div>

          <div className="info-row">
            <span className="info-label">Role</span>
            <span className="info-separator">:</span>
            <span className="info-value">{user.role.replace('_', ' ').toUpperCase()}</span>
          </div>

          <div className="info-row">
            <span className="info-label">Phone Number</span>
            <span className="info-separator">:</span>
            <span className="info-value">Not Available</span>
          </div>

          <div className="info-row">
            <span className="info-label">Last Login</span>
            <span className="info-separator">:</span>
            <span className="info-value">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="profile-divider"></div>

        {/* Action Buttons - Bottom Right */}
        <div className="profile-actions">
          {isEditing ? (
            <div className="edit-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsEditing(false);
                  setEditForm({
                    fullName: user.name,
                    email: user.email,
                    phone: ''
                  });
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleEditSubmit}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <>
              <button
                className="btn btn-primary"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowPasswordModal(true)}
              >
                Change Password
              </button>
            </>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button
                className="modal-close"
                onClick={() => setShowPasswordModal(false)}
              >
                <XCircle size={20} strokeWidth={2} />
              </button>
            </div>
            <form className="modal-form" onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordForm({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

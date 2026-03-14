// models/Employee.js
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  // Personal Information
  firstName: { type: String, required: true, trim: true },
  middleName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  
  // Bank Details
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifscCode: { type: String, required: true, uppercase: true },
  accountHolderName: { type: String, required: true },
  bankBranch: { type: String },
  
  // Employment Details
  position: { type: String, required: true },
  department: { type: String, required: true },
  circle: { type: String },
  projectName: { type: String },
  joiningDate: { type: Date, required: true },
  employeeId: { type: String, unique: true, sparse: true },
  reportingManager: { type: String },
  employmentType: { 
    type: String, 
    required: true,
    enum: ['Full-time', 'Part-time', 'Contract', 'Intern']
  },
  
  // Documents (file paths)
  documents: {
    aadharCard: { type: String, required: true },
    idPhoto: { type: String, required: true },
    bankPassbook: { type: String, required: true },
    panCard: { type: String }
  },
  
  // Registration metadata
  registrationLinkId: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'active', 'inactive'],
    default: 'pending'
  },
  
  // Approval tracking
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  
}, {
  timestamps: true
});

// Index for faster queries
employeeSchema.index({ email: 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ department: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
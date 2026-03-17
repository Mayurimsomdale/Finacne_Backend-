import React from 'react';
import { Briefcase, Building, Calendar, MapPin, DollarSign, UserCircle, Layers } from 'lucide-react';

const EmploymentDetailsStep = ({ formData, errors, onChange }) => {
  const jobPositions = [
    'Corporate Office Manager',
    'Coordinator',
    'Report Maker',
    'DT Engineer',
    'Service Engineer',
    'HR & Admin',
    'HSW Lead',
    'Intern',
    'IT Manager',
    'Manager',
    'Operations Head',
    'Project Manager',
    'Operations Lead',
    'Rigger',
    'Software Engineer',
    'Store Manager',
    'Technician',
    'Accountant',
    'Other'
  ];

  const departments = [
    'IT',
    'Telecom',
    'Engineering',
    'Finance',
    'Sales',
    'Marketing',
    'Other'
  ];

  const circles = [
    'Gujarat',
    'HP (Himachal Pradesh)',
    'MH (Maharashtra)',
    'MH (Pune Office)',
    'MH Nagpur',
    'MH_Ahilyanagar',
    'MH_Nagpur',
    'MH_Pen',
    'MPCG',
    'Mumbai',
    'Punjab',
    'Pune',
    'Other'
  ];

  const projectNames = [
    'Corporate',
    'E// JIO',
    'E// JIO EMF',
    'E// JIO TI',
    'E// JIO UBR',
    'E// VIL',
    'IGR',
    'IT',
    'Smart Intelligent Village',
    'VIL MM'
  ];

  const isTelecomDepartment = formData.department === 'Telecom';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Employment Details</h2>
        <p className="text-gray-600">Provide information about your role and employment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Position */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Position/Job Title <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              name="position"
              value={formData.position}
              onChange={onChange}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.position ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select position</option>
              {jobPositions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>
          {errors.position && (
            <p className="mt-1 text-sm text-red-500">{errors.position}</p>
          )}
        </div>

        {/* Department */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Department <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              name="department"
              value={formData.department}
              onChange={onChange}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.department ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          {errors.department && (
            <p className="mt-1 text-sm text-red-500">{errors.department}</p>
          )}
        </div>

        {/* Circle - Only show if Telecom department is selected */}
        {isTelecomDepartment && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Circle <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                name="circle"
                value={formData.circle || ''}
                onChange={onChange}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  errors.circle ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select circle</option>
                {circles.map((circle) => (
                  <option key={circle} value={circle}>
                    {circle}
                  </option>
                ))}
              </select>
            </div>
            {errors.circle && (
              <p className="mt-1 text-sm text-red-500">{errors.circle}</p>
            )}
          </div>
        )}

        {/* Project Name - Only show if Telecom department is selected */}
        {isTelecomDepartment && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                name="projectName"
                value={formData.projectName || ''}
                onChange={onChange}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  errors.projectName ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select project</option>
                {projectNames.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </div>
            {errors.projectName && (
              <p className="mt-1 text-sm text-red-500">{errors.projectName}</p>
            )}
          </div>
        )}

        {/* Employee ID */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Employee ID (if assigned)
          </label>
          <input
            type="text"
            name="employeeId"
            value={formData.employeeId}
            onChange={onChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="EMP-12345"
          />
        </div>

        {/* Joining Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Joining Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="date"
              name="joiningDate"
              value={formData.joiningDate}
              onChange={onChange}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.joiningDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.joiningDate && (
            <p className="mt-1 text-sm text-red-500">{errors.joiningDate}</p>
          )}
        </div>

        {/* Reporting Manager */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Reporting Manager
          </label>
          <div className="relative">
            <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="reportingManager"
              value={formData.reportingManager}
              onChange={onChange}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Manager's name"
            />
          </div>
        </div>


        {/* Employment Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Employment Type <span className="text-red-500">*</span>
          </label>
          <select
            name="employmentType"
            value={formData.employmentType}
            onChange={onChange}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              errors.employmentType ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select employment type</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
            <option value="temporary">Temporary</option>
          </select>
          {errors.employmentType && (
            <p className="mt-1 text-sm text-red-500">{errors.employmentType}</p>
          )}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
        <p className="text-sm text-yellow-800">
          <strong>Please review:</strong> Make sure all information is accurate before submitting. You won't be able to edit this information after submission.
        </p>
      </div>
    </div>
  );
};

export default EmploymentDetailsStep;
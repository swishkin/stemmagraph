import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, User, Calendar, MapPin, Briefcase, Phone } from 'lucide-react';
import type { FamilyMember } from '../../../types/family';
import { AvatarEditor } from '../../Forms/AvatarEditor';

interface MemberEditModalProps {
  member: FamilyMember;
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: FamilyMember) => void;
}

export const MemberEditModal: React.FC<MemberEditModalProps> = ({
  member,
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<FamilyMember>(member);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(member);
      setErrors({});
    }
  }, [member, isOpen]);

  const validateForm = (): boolean => {
    // Unified validation contract: the edit dialog and the add dialog
    // (UnifiedMemberModal.validateForm) must enforce exactly the same
    // requirements on every field — same required fields, same
    // date-order rule. Keep both in sync.
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('memberEdit.errorNameRequired');
    } else if (formData.name.trim().length < 2) {
      newErrors.name = t('memberModal.errorNameShort');
    }

    if (!formData.birthDate) {
      newErrors.birthDate = t('memberEdit.errorBirthDateRequired');
    } else if (isNaN(new Date(formData.birthDate).getTime())) {
      newErrors.birthDate = t('memberModal.errorBirthDate');
    }

    if (!formData.birthPlace?.trim()) {
      newErrors.birthPlace = t('memberEdit.errorBirthPlaceRequired');
    }

    if (!formData.gender) {
      newErrors.gender = t('memberEdit.errorGenderRequired');
    }

    // Death date must be on or after the birth date.
    if (
      !formData.isAlive &&
      formData.deathDate &&
      !isNaN(new Date(formData.birthDate).getTime()) &&
      new Date(formData.birthDate) > new Date(formData.deathDate)
    ) {
      newErrors.deathDate = t('memberEdit.errorDeathBeforeBirth');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleInputChange = (field: keyof FamilyMember, value: string | boolean | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('memberEdit.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
            aria-label={t('memberEdit.closeModal')}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Photo / avatar */}
          <div>
            <AvatarEditor
              photoUrl={formData.photoUrl}
              email={formData.email}
              name={formData.name}
              gender={formData.gender}
              onPhotoUrlChange={(url) =>
                setFormData((prev) => ({ ...prev, photoUrl: url ?? undefined }))
              }
            />
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div>
              <label htmlFor="member-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('memberEdit.fullName')} *
              </label>
              <input
                id="member-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder={t('memberEdit.placeholderName')}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
              )}
            </div>

            {/* Nickname */}
            <div>
              <label htmlFor="member-nickname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('memberEdit.nickname')}
              </label>
              <input
                id="member-nickname"
                type="text"
                value={formData.nickname ?? ''}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                placeholder={t('memberEdit.placeholderNickname')}
              />
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="member-gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('memberEdit.gender')} *
              </label>
              <select
                id="member-gender"
                value={formData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                  errors.gender ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                <option value="">{t('memberEdit.selectGender')}</option>
                <option value="male">{t('memberEdit.male')}</option>
                <option value="female">{t('memberEdit.female')}</option>
              </select>
              {errors.gender && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.gender}</p>
              )}
            </div>

            {/* Generation */}
            <div>
              <label htmlFor="member-generation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('memberEdit.generation')}
              </label>
              <input
                id="member-generation"
                type="number"
                min="1"
                max="10"
                value={formData.generation}
                onChange={(e) => handleInputChange('generation', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Privacy Status */}
            <div>
              <label htmlFor="member-privacy-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('memberEdit.privacyStatus', 'Privacy Status')}
              </label>
              <select
                id="member-privacy-status"
                value={formData.privacyStatus ?? 'shared'}
                onChange={(e) => handleInputChange('privacyStatus', e.target.value as 'shared' | 'private')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="shared">{t('memberEdit.privacyShared', 'Shared, include in public tree exports')}</option>
                <option value="private">{t('memberEdit.privacyPrivate', 'Private, redact in public tree exports')}</option>
              </select>
            </div>
          </div>

          {/* Birth Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              {t('memberEdit.birthInfo')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="member-birth-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('memberEdit.birthDate')} *
                </label>
                <input
                  id="member-birth-date"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => handleInputChange('birthDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                    errors.birthDate ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                />
                {errors.birthDate && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.birthDate}</p>
                )}
              </div>

              <div>
                <label htmlFor="member-birth-place" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('memberEdit.birthPlace')} *
                </label>
                <input
                  id="member-birth-place"
                  type="text"
                  value={formData.birthPlace ?? ''}
                  onChange={(e) => handleInputChange('birthPlace', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                    errors.birthPlace ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                  placeholder={t('memberEdit.placeholderBirthPlace')}
                />
                {errors.birthPlace && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.birthPlace}</p>
                )}
              </div>
            </div>
          </div>

          {/* Life Status */}
          <div className="border-t pt-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-center">
                <input
                  id="member-alive"
                  type="checkbox"
                  checked={formData.isAlive}
                  onChange={(e) => handleInputChange('isAlive', e.target.checked)}
                  className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="member-alive" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('memberEdit.living')}
                </label>
              </div>
            </div>

            {!formData.isAlive && (
              <div>
                <label htmlFor="member-death-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('memberEdit.deathDate')}
                </label>
                <input
                  id="member-death-date"
                  type="date"
                  value={formData.deathDate ?? ''}
                  onChange={(e) => handleInputChange('deathDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 max-w-xs ${
                    errors.deathDate ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                />
                {errors.deathDate && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.deathDate}</p>
                )}
              </div>
            )}
          </div>

          {/* Professional Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Briefcase className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              {t('memberEdit.profInfo')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="member-profession" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('memberEdit.profession')}
                </label>
                <input
                  id="member-profession"
                  type="text"
                  value={formData.profession ?? ''}
                  onChange={(e) => handleInputChange('profession', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder={t('memberEdit.placeholderProfession')}
                />
              </div>

              <div>
                <label htmlFor="member-education" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('memberEdit.education')}
                </label>
                <input
                  id="member-education"
                  type="text"
                  value={formData.education ?? ''}
                  onChange={(e) => handleInputChange('education', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder={t('memberEdit.placeholderEducation')}
                />
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              {t('memberEdit.locInfo')}
            </h3>
            <div>
              <label htmlFor="member-location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('memberEdit.currentLocation')}
              </label>
              <input
                id="member-location"
                type="text"
                value={formData.currentLocation ?? ''}
                onChange={(e) => handleInputChange('currentLocation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                placeholder={t('memberEdit.placeholderLocation')}
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Phone className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              {t('memberEdit.contactInfo')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="member-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('memberEdit.phone')}
                </label>
                <input
                  id="member-phone"
                  type="tel"
                  value={formData.phone ?? ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="+62812345678"
                />
              </div>

              <div>
                <label htmlFor="member-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('memberEdit.email')}
                </label>
                <input
                  id="member-email"
                  type="email"
                  value={formData.email ?? ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="name@email.com"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t pt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {t('memberEdit.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {t('memberEdit.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
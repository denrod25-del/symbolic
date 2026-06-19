import { describe, expect, it } from 'vitest';
import {
  CRM_OPEN_STAGES,
  CRM_STAGES,
  isCrmAppointmentStatus,
  isCrmMessageChannel,
  isCrmStage,
} from './Crm';

describe('Crm', () => {
  describe('isCrmStage', () => {
    it('accepts a known pipeline stage', () => {
      expect(isCrmStage('qualified')).toBe(true);
    });

    it('rejects an unknown stage', () => {
      expect(isCrmStage('archived')).toBe(false);
    });
  });

  describe('CRM_OPEN_STAGES', () => {
    it('excludes the won and lost closing stages', () => {
      expect(CRM_OPEN_STAGES).not.toContain('won');
      expect(CRM_OPEN_STAGES).not.toContain('lost');
    });

    it('contains only valid pipeline stages', () => {
      for (const stage of CRM_OPEN_STAGES) {
        expect(CRM_STAGES).toContain(stage);
      }
    });
  });

  describe('isCrmAppointmentStatus', () => {
    it('accepts a known appointment status', () => {
      expect(isCrmAppointmentStatus('completed')).toBe(true);
    });

    it('rejects an unknown status', () => {
      expect(isCrmAppointmentStatus('rescheduled')).toBe(false);
    });
  });

  describe('isCrmMessageChannel', () => {
    it('accepts sms and email channels', () => {
      expect(isCrmMessageChannel('sms')).toBe(true);
      expect(isCrmMessageChannel('email')).toBe(true);
    });

    it('rejects an unsupported channel', () => {
      expect(isCrmMessageChannel('whatsapp')).toBe(false);
    });
  });
});

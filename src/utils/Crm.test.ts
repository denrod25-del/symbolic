import { describe, expect, it } from 'vitest';
import {
  CRM_OPEN_STAGES,
  CRM_STAGES,
  isCrmAppointmentStatus,
  isCrmMessageChannel,
  isCrmQuoteStatus,
  isCrmStage,
  isCrmWorkflowAction,
  isCrmWorkflowTrigger,
  quoteLineItemsTotal,
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

  describe('isCrmWorkflowTrigger', () => {
    it('accepts a known trigger', () => {
      expect(isCrmWorkflowTrigger('opportunity_stage_changed')).toBe(true);
    });

    it('rejects an unknown trigger', () => {
      expect(isCrmWorkflowTrigger('contact_deleted')).toBe(false);
    });
  });

  describe('isCrmWorkflowAction', () => {
    it('accepts a known action', () => {
      expect(isCrmWorkflowAction('send_message')).toBe(true);
    });

    it('rejects an unknown action', () => {
      expect(isCrmWorkflowAction('charge_card')).toBe(false);
    });
  });

  describe('isCrmQuoteStatus', () => {
    it('accepts a known quote status', () => {
      expect(isCrmQuoteStatus('accepted')).toBe(true);
    });

    it('rejects an unknown status', () => {
      expect(isCrmQuoteStatus('expired')).toBe(false);
    });
  });

  describe('quoteLineItemsTotal', () => {
    it('sums quantity times unit price across line items', () => {
      const total = quoteLineItemsTotal([
        { description: 'Call-out', quantity: 1, unitPrice: 5000 },
        { description: 'Labour', quantity: 3, unitPrice: 4500 },
      ]);

      expect(total).toBe(18_500);
    });

    it('returns zero for no line items', () => {
      expect(quoteLineItemsTotal([])).toBe(0);
    });
  });
});

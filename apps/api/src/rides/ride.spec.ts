import { assertTransition, RideConflictError } from './ride';

describe('ride transitions', () => {
  it('advances one step at a time', () => {
    expect(() => assertTransition('REQUESTED', 'ACCEPTED')).not.toThrow();
    expect(() => assertTransition('ACCEPTED', 'IN_PROGRESS')).not.toThrow();
    expect(() => assertTransition('IN_PROGRESS', 'COMPLETED')).not.toThrow();
  });

  it('rejects skipped, reverse and finished transitions', () => {
    expect(() => assertTransition('REQUESTED', 'IN_PROGRESS')).toThrow(RideConflictError);
    expect(() => assertTransition('ACCEPTED', 'REQUESTED')).toThrow(RideConflictError);
    expect(() => assertTransition('COMPLETED', 'ACCEPTED')).toThrow(RideConflictError);
  });
});

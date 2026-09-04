import { action } from '../_shared';

export const POST = (request: Request) => action(request, 'propose_snapshot_change');

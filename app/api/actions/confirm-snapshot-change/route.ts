import { action } from '../_shared';

export const POST = (request: Request) => action(request, 'confirm_snapshot_change');

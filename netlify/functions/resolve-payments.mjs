import {reconcilePendingCheckouts} from '../lib/billing.mjs';
export default async()=>{await reconcilePendingCheckouts()};
export const config={schedule:'0 */2 * * *'};

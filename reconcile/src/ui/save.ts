import { download } from '../lib/exports';
import { toast } from './hooks';

/** Save a file and report the outcome to the user. */
export async function saveFile(filename: string, content: string, mime?: string) {
  try {
    await download(filename, content, mime);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'declined') toast('Download cancelled.');
    else if (code === 'rate_limited') toast('Another download is waiting for confirmation. Try again in a moment.', 'error');
    else toast(`The file could not be saved here${(e as Error)?.message ? `: ${(e as Error).message}` : ''}.`, 'error');
  }
}

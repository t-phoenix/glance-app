import { File } from 'expo-file-system';

/** Groq Whisper. The recording is read as bytes because Expo fetch cannot upload a file uri. */
export async function transcribeRecording(uri: string, groqKey: string): Promise<string> {
  const bytes = await new File(uri).bytes();
  const form = new FormData();
  form.append('file', { name: 'note.m4a', type: 'audio/mp4', bytes: () => bytes } as unknown as Blob);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'json');
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });
  if (response.status === 401 || response.status === 403) throw new Error('The Groq key was rejected. Check Settings.');
  if (!response.ok) throw new Error('The recording could not be transcribed.');
  const json = (await response.json()) as { text?: string };
  const text = json.text?.trim() ?? '';
  if (!text) throw new Error("Couldn't hear anything in that note.");
  return text;
}

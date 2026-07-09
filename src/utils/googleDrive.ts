/**
 * Google Drive API Helpers for uploading photostrips.
 */

export async function getOrCreateFolder(accessToken: string, folderName: string): Promise<string> {
  // Query for the folder
  const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (!res.ok) {
    throw new Error(`Failed to query Google Drive folder: ${res.statusText}`);
  }
  
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  
  // Create the folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  
  if (!createRes.ok) {
    throw new Error(`Failed to create Google Drive folder: ${createRes.statusText}`);
  }
  
  const createdFolder = await createRes.json();
  return createdFolder.id;
}

export async function uploadPhotostripToDrive(
  accessToken: string,
  base64DataUrl: string,
  fileName: string,
  folderId?: string
): Promise<{ id: string; webViewLink?: string }> {
  const base64Content = base64DataUrl.includes('base64,') 
    ? base64DataUrl.split('base64,')[1] 
    : base64DataUrl;
    
  const boundary = 'photobooth_drive_upload_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  
  const metadata: any = {
    name: fileName,
    mimeType: 'image/png'
  };
  
  if (folderId) {
    metadata.parents = [folderId];
  }
  
  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: image/png\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Content +
    closeDelimiter;
    
  // Upload file
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('[DRIVE UPLOAD ERROR]', errorText);
    throw new Error(`Failed to upload to Google Drive: ${res.statusText}`);
  }
  
  const fileData = await res.json();
  
  // Optionally, get more metadata including webViewLink so we can link directly to it!
  try {
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}?fields=webViewLink,webContentLink`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      return { id: fileData.id, webViewLink: metaData.webViewLink };
    }
  } catch (err) {
    console.error('Failed to fetch full Drive file metadata:', err);
  }
  
  return { id: fileData.id };
}

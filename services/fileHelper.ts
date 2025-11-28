import { UploadedFile } from '../types';

export const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target?.result as string);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Remove data url prefix (e.g. "data:image/png;base64,") to get raw base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const processFiles = async (files: FileList | null): Promise<UploadedFile[]> => {
  if (!files) return [];

  const processedFiles: UploadedFile[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    // Text based files
    if (file.type.startsWith('text/') || ['md', 'json', 'csv', 'txt'].includes(fileExtension || '')) {
      try {
        const content = await readFileContent(file);
        processedFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          content: content,
          source: 'local',
          size: file.size,
          mimeType: 'text/plain'
        });
      } catch (e) {
        console.error(`Failed to read file ${file.name}`, e);
      }
    } 
    // Binary files (Images, Videos, PDFs)
    else if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type === 'application/pdf') {
       try {
        const base64 = await readFileAsBase64(file);
        processedFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          content: `Binary File: ${file.name}`, // Placeholder content for display logic
          source: 'local',
          size: file.size,
          mimeType: file.type,
          data: base64
        });
       } catch (e) {
         console.error(`Failed to read binary file ${file.name}`, e);
       }
    }
    else {
        console.warn(`Skipping unsupported file type: ${file.name} (${file.type})`);
    }
  }

  return processedFiles;
};
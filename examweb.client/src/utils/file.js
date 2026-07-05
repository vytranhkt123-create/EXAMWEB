export const MAX_PDF_FILE_SIZE_BYTES = 50 * 1024 * 1024

export function validatePdfFileSize(file) {
    if (file?.size > MAX_PDF_FILE_SIZE_BYTES) {
        return 'File exceeds 50MB'
    }

    return ''
}

export function readFileAsDataUrl(file) {
    const sizeError = validatePdfFileSize(file)
    if (sizeError) {
        return Promise.reject(new Error(sizeError))
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn'))
        reader.readAsDataURL(file)
    })
}

export function dataUrlToBlob(dataUrl) {
    const [metadata = '', base64 = ''] = String(dataUrl || '').split(',')
    const contentType = metadata.match(/^data:(.*?);base64$/i)?.[1] || 'application/pdf'
    const binary = window.atob(base64)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
    }

    return new Blob([bytes], { type: contentType })
}

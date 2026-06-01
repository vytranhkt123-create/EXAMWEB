const DEFAULT_MAX_IMAGE_BYTES = 720_000
const DEFAULT_MAX_IMAGE_SIZE = 1280
const DEFAULT_IMAGE_QUALITY = 0.74

export async function compressImageFile(file, {
    maxBytes = DEFAULT_MAX_IMAGE_BYTES,
    maxSize = DEFAULT_MAX_IMAGE_SIZE,
    quality = DEFAULT_IMAGE_QUALITY,
} = {}) {
    if (!file?.type?.startsWith('image/')) {
        throw new Error('Vui lòng chọn tệp hình ảnh')
    }

    const sourceDataUrl = await readFileAsDataUrl(file)
    const image = await loadImage(sourceDataUrl)

    let scale = Math.min(1, maxSize / Math.max(image.width, image.height))
    let nextQuality = quality
    let dataUrl = ''

    for (let attempt = 0; attempt < 6; attempt += 1) {
        dataUrl = renderImageToDataUrl(image, scale, nextQuality)
        if (estimateDataUrlBytes(dataUrl) <= maxBytes) {
            return dataUrl
        }

        nextQuality = Math.max(0.48, nextQuality - 0.08)
        if (nextQuality <= 0.5) {
            scale *= 0.84
        }
    }

    if (estimateDataUrlBytes(dataUrl) > maxBytes) {
        throw new Error('Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn')
    }

    return dataUrl
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh'))
        reader.readAsDataURL(file)
    })
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Không thể mở ảnh đã chọn'))
        image.src = dataUrl
    })
}

function renderImageToDataUrl(image, scale, quality) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))

    const context = canvas.getContext('2d')
    if (!context) {
        throw new Error('Trình duyệt không hỗ trợ xử lý ảnh')
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
}

function estimateDataUrlBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1] || ''
    return Math.ceil((base64.length * 3) / 4)
}

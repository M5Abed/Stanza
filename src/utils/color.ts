/**
 * Extracts average color from an image by down-sampling it via standard canvas context.
 */
export async function getDominantColor(imgUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return resolve('#8B5CF6') // Fallback to theme-accent
      
      ctx.drawImage(img, 0, 0, 1, 1)
      try {
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
        resolve(`rgb(${r}, ${g}, ${b})`)
      } catch {
        resolve('#8B5CF6')
      }
    }
    img.onerror = () => resolve('#8B5CF6')
    img.src = imgUrl
  })
}

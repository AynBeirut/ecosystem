import React from 'react'
import { Facebook, MessageCircle, Instagram, Link as LinkIcon, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

type Props = {
  url: string
  title?: string
  description?: string
}

const encoded = (s?: string) => encodeURIComponent(s || '')

const ShareButtons: React.FC<Props> = ({ url, title, description }) => {
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copied', description: 'Product link copied to clipboard.' })
    } catch (err) {
      toast({ title: 'Copy failed', description: 'Unable to copy link.', variant: 'destructive' })
    }
  }

  const handleNativeShare = async () => {
    type WebNavigator = Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> }
    const webNav = navigator as WebNavigator
    if (typeof webNav.share === 'function') {
      try {
        await webNav.share({ title, text: description, url })
      } catch (err) {
        // user cancelled or error
      }
      return true
    }
    return false
  }

  const openWindow = (href: string) => window.open(href, '_blank', 'noopener')

  const shareFacebook = async () => {
    if (await handleNativeShare()) return
    const href = `https://www.facebook.com/sharer/sharer.php?u=${encoded(url)}`
    openWindow(href)
  }

  const shareWhatsApp = async () => {
    if (await handleNativeShare()) return
    const text = `${title ? title + '\n' : ''}${description || ''}\n${url}`
    const href = `https://wa.me/?text=${encoded(text)}`
    openWindow(href)
  }

  const shareInstagramStory = async () => {
    // Instagram doesn't support direct web share to feed; attempt story via Intent (mobile) or fallback to copy
    if (await handleNativeShare()) return
    // Try Instagram story (Android intent) fallback: guide user by copying link
    try {
      // Attempt to open instagram app deep link (may be blocked on web)
      const intent = `instagram://story-camera?source_application=market-flow`;
      window.location.href = intent
      // if that fails, fall through to copy after a short delay
      setTimeout(() => handleCopy(), 800)
    } catch {
      handleCopy()
    }
  }

  const shareTikTok = async () => {
    if (await handleNativeShare()) return
    // TikTok does not provide a web sharer; fallback to copy link and toast with instructions
    await handleCopy()
    toast({ title: 'Tip', description: 'Open TikTok and paste the link into your story or post.' })
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={shareFacebook} aria-label="Share on Facebook">
        <Facebook className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="sm" onClick={shareInstagramStory} aria-label="Share to Instagram Story">
        <Instagram className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="sm" onClick={shareTikTok} aria-label="Share on TikTok">
        <MessageCircle className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="sm" onClick={shareWhatsApp} aria-label="Share on WhatsApp">
        <Phone className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="sm" onClick={handleCopy} aria-label="Copy link">
        <LinkIcon className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default ShareButtons

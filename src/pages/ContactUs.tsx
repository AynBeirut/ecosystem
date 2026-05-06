import React, { useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';

const ContactUs: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/contact/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Failed to send');
      }
      setSent(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to send your message: ${msg}. Please email us directly at support@grabio.space`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Contact Us</h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Have a question, feedback, or need help? We'd love to hear from you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Contact Info */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 text-blue-600 rounded-full p-2 mt-0.5">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Email</p>
                    <a
                      href="mailto:support@grabio.space"
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      support@grabio.space
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-green-100 text-green-600 rounded-full p-2 mt-0.5">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Phone &amp; WhatsApp</p>
                    <a
                      href="https://wa.me/96171110952"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-green-600 hover:underline"
                    >
                      +961 71 110 952
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-orange-100 text-orange-600 rounded-full p-2 mt-0.5">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Location</p>
                    <p className="text-sm text-gray-500">Beirut, Lebanon</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-5">
                <p className="text-sm text-blue-800 font-medium mb-1">Support Hours</p>
                <p className="text-sm text-blue-700">Monday – Friday</p>
                <p className="text-sm text-blue-700">9:00 AM – 6:00 PM (GMT+3)</p>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Send Us a Message</CardTitle>
                <CardDescription>We typically respond within 24 hours.</CardDescription>
              </CardHeader>
              <CardContent>
                {sent ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                    <CheckCircle className="h-14 w-14 text-green-500" />
                    <h3 className="text-xl font-semibold text-gray-800">Message Sent!</h3>
                    <p className="text-gray-500 max-w-xs">
                      Thank you for reaching out. We'll get back to you as soon as possible.
                    </p>
                    <Button variant="outline" onClick={() => setSent(false)}>
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-name">Full Name *</Label>
                        <Input
                          id="contact-name"
                          name="name"
                          autoComplete="name"
                          placeholder="Your name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-email">Email Address *</Label>
                        <Input
                          id="contact-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contact-subject">Subject *</Label>
                      <Input
                        id="contact-subject"
                        name="subject"
                        autoComplete="off"
                        placeholder="How can we help?"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contact-message">Message *</Label>
                      <Textarea
                        id="contact-message"
                        name="message"
                        autoComplete="off"
                        placeholder="Write your message here..."
                        rows={6}
                        value={formData.message}
                        onChange={handleChange}
                        required
                        className="resize-none"
                      />
                    </div>

                    {error && (
                      <p className="text-sm text-red-600">{error}</p>
                    )}

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isSending} className="gap-2">
                        <Send className="h-4 w-4" />
                        {isSending ? 'Sending...' : 'Send Message'}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContactUs;

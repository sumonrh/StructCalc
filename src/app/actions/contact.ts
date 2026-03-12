'use server';

import { initializeFirebase } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';

/**
 * Server action to handle contact form submissions.
 * This writes to the 'mail' collection, which the "Trigger Email" 
 * Firebase Extension monitors to send real emails.
 */
export async function submitContactForm(formData: FormData) {
  const email = formData.get('email');
  const subject = formData.get('subject');
  const message = formData.get('message');

  const targetEmail = process.env.CONTACT_EMAIL;

  if (!email || !subject || !message) {
    return { success: false, message: 'All fields are required.' };
  }

  if (!targetEmail) {
    console.error('CONTACT_EMAIL environment variable is not set.');
    return { success: false, message: 'Server configuration error. Please try again later.' };
  }

  try {
    const { firestore } = initializeFirebase();
    
    // Writing to the 'mail' collection triggers the Firebase extension.
    // Ensure you configure the extension to look at the 'mail' collection.
    await addDoc(collection(firestore, 'mail'), {
      to: targetEmail,
      message: {
        subject: `[StrucTCalc Contact] ${subject}`,
        text: `From: ${email}\n\nMessage: ${message}`,
        html: `<p><strong>From:</strong> ${email}</p><p><strong>Message:</strong></p><p>${message}</p>`,
      },
      createdAt: new Date().toISOString(),
    });

    return { 
      success: true, 
      message: 'Your message has been queued for delivery. Thank you!' 
    };
  } catch (error) {
    console.error('Error triggering email:', error);
    return { success: false, message: 'Failed to transmit message. Please try again.' };
  }
}
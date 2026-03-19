'use client';

import { useState } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { submitContactForm } from '@/app/actions/contact';
import { useToast } from '@/hooks/use-toast';

export function ContactForm() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await submitContactForm(formData);

    setIsPending(false);

    if (result.success) {
      setIsSuccess(true);
      toast({
        title: "Message Sent",
        description: result.message,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.message,
      });
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-16 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-500 shadow-2xl">
        <div className="bg-sky-500/20 p-6 rounded-full">
          <CheckCircle2 className="h-16 w-16 text-sky-500" />
        </div>
        <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Message Transmitted</h3>
        <p className="text-slate-400 max-w-md font-bold leading-relaxed">
          Your inquiry has been successfully sent to the author. Thank you for your feedback and interest in StrucTCalc.
        </p>
        <button 
          onClick={() => setIsSuccess(false)}
          className="bg-slate-800 hover:bg-slate-700 text-sky-400 font-black px-8 py-3 rounded-2xl transition-all uppercase tracking-widest text-xs border border-sky-500/20"
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 md:p-16 shadow-2xl space-y-10 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-800 pb-8">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic flex items-center gap-4">
            <Mail className="h-8 w-8 text-sky-500" />
            Contact Author
          </h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Inquiries, Bug Reports, & Feature Requests</p>
        </div>
        <div className="bg-sky-950/20 border border-sky-500/20 p-4 rounded-2xl flex gap-3 max-w-xs">
          <AlertCircle className="w-5 h-5 text-sky-500 shrink-0" />
          <p className="text-[10px] font-bold text-sky-400/80 leading-tight uppercase tracking-wide">
            Response times may vary. This tool is for research and study purposes only.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Your Email Address</label>
            <input 
              required
              name="email"
              type="email" 
              placeholder="engineer@example.com"
              className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner placeholder:text-slate-800"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Subject</label>
            <input 
              required
              name="subject"
              type="text" 
              placeholder="e.g., Feature Request: Truss Analysis"
              className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner placeholder:text-slate-800"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Detailed Message</label>
          <textarea 
            required
            name="message"
            rows={6}
            placeholder="Type your message here..."
            className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl p-6 text-sm font-bold text-white focus:border-sky-500 outline-none transition-all shadow-inner placeholder:text-slate-800 resize-none"
          ></textarea>
        </div>

        <button 
          type="submit"
          disabled={isPending}
          className={`w-full flex items-center justify-center gap-3 py-6 rounded-3xl font-black uppercase tracking-widest transition-all shadow-2xl ${isPending ? 'bg-slate-800 text-slate-600 cursor-wait' : 'bg-sky-500 text-slate-950 hover:bg-sky-400 active:scale-95 text-lg'}`}
        >
          {isPending ? 'Processing...' : <><Send className="h-6 w-6" /> Send Message</>}
        </button>
      </form>
    </section>
  );
}

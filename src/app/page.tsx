import { Header } from '@/components/Header';
import { UnitConversion } from '@/components/UnitConversion';
import { BucklingCalculation } from '@/components/BucklingCalculation';
import { BeamDeflection } from '@/components/BeamDeflection';
import { FootingStress } from '@/components/FootingStress';
import { RCSectionDesign } from '@/components/RCSectionDesign';
import { RCColumnAnalysis } from '@/components/RCColumnAnalysis';
import { StructuralAnalysis } from '@/components/StructuralAnalysis';
import { LiveLoadAnalysis } from '@/components/LiveLoadAnalysis';
import { SteelGirder } from '@/components/SteelGirder';
import { ContactForm } from '@/components/ContactForm';
import { SectionPropertyPro } from '@/components/SectionPropertyPro';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ruler, DraftingCompass, Workflow, Truck, Square, Activity, Box, MoveVertical, ShieldAlert, SquareArrowDown, Mail, Github, AlertTriangle, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      <Header />
      <main className="flex-grow container mx-auto p-6 md:p-10 lg:p-12">
        <Tabs defaultValue="analysis" className="w-full">
          <div className="flex justify-center mb-12">
            <TabsList className="bg-slate-900 border-2 border-slate-800 p-1.5 rounded-[2.5rem] h-auto gap-2 flex-wrap justify-center shadow-2xl">
               <TabsTrigger value="analysis" className="rounded-[2rem] px-6 py-3 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-xs uppercase tracking-widest transition-all">
                <Workflow className="mr-2 h-4 w-4" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="section-prop" className="rounded-[2rem] px-6 py-3 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-xs uppercase tracking-widest transition-all">
                <Zap className="mr-2 h-4 w-4" />
                Section Props
              </TabsTrigger>
              <TabsTrigger value="live-load" className="rounded-[2rem] px-6 py-3 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-xs uppercase tracking-widest transition-all">
                <Truck className="mr-2 h-4 w-4" />
                Live Load
              </TabsTrigger>
              <TabsTrigger value="steel-girder" className="rounded-[2rem] px-6 py-3 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-xs uppercase tracking-widest transition-all">
                <Square className="mr-2 h-4 w-4" />
                Steel Girder
              </TabsTrigger>
              <TabsTrigger value="column-analysis" className="rounded-[2rem] px-6 py-3 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-xs uppercase tracking-widest transition-all">
                <Activity className="mr-2 h-4 w-4" />
                RC Column
              </TabsTrigger>
              <TabsTrigger value="component-design" className="rounded-[2rem] px-6 py-3 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-xs uppercase tracking-widest transition-all">
                <DraftingCompass className="mr-2 h-4 w-4" />
                Components
              </TabsTrigger>
              <TabsTrigger value="conversion" className="rounded-[2rem] px-6 py-3 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-xs uppercase tracking-widest transition-all">
                 <Ruler className="mr-2 h-4 w-4" />
                Units
              </TabsTrigger>
              <TabsTrigger value="contact" className="rounded-[2rem] px-6 py-3 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-xs uppercase tracking-widest transition-all">
                 <Mail className="mr-2 h-4 w-4" />
                Contact
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analysis" className="mt-0 outline-none">
            <div className="bg-slate-900/50 p-1 rounded-[3.5rem] border-2 border-slate-800">
              <StructuralAnalysis />
            </div>
          </TabsContent>

          <TabsContent value="section-prop" className="mt-0 outline-none">
            <SectionPropertyPro />
          </TabsContent>

          <TabsContent value="live-load" className="mt-0 outline-none">
            <LiveLoadAnalysis />
          </TabsContent>

          <TabsContent value="steel-girder" className="mt-0 outline-none">
            <SteelGirder />
          </TabsContent>

          <TabsContent value="column-analysis" className="mt-0 outline-none">
            <RCColumnAnalysis />
          </TabsContent>

          <TabsContent value="component-design" className="mt-0 outline-none">
             <Tabs defaultValue="rc-beam" className="w-full">
                <div className="flex justify-start mb-10">
                    <TabsList className="bg-slate-900 border-2 border-slate-800 p-1.5 rounded-[2rem] h-auto gap-2 shadow-xl">
                        <TabsTrigger value="rc-beam" className="rounded-[1.5rem] px-6 py-2.5 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-[10px] uppercase tracking-[0.15em]">
                            <Box className="mr-2 h-3.5 w-3.5" /> RC Beam
                        </TabsTrigger>
                        <TabsTrigger value="footing" className="rounded-[1.5rem] px-6 py-2.5 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-[10px] uppercase tracking-[0.15em]">
                            <SquareArrowDown className="mr-2 h-3.5 w-3.5" /> Footing
                        </TabsTrigger>
                        <TabsTrigger value="buckling" className="rounded-[1.5rem] px-6 py-2.5 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-[10px] uppercase tracking-[0.15em]">
                            <ShieldAlert className="mr-2 h-3.5 w-3.5" /> Buckling
                        </TabsTrigger>
                        <TabsTrigger value="deflection" className="rounded-[1.5rem] px-6 py-2.5 data-[state=active]:bg-sky-500 data-[state=active]:text-slate-950 font-black text-[10px] uppercase tracking-[0.15em]">
                            <MoveVertical className="mr-2 h-3.5 w-3.5" /> Deflection
                        </TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="rc-beam" className="outline-none">
                    <RCSectionDesign />
                </TabsContent>
                <TabsContent value="footing" className="outline-none">
                    <FootingStress />
                </TabsContent>
                <TabsContent value="buckling" className="outline-none">
                    <BucklingCalculation />
                </TabsContent>
                <TabsContent value="deflection" className="outline-none">
                    <BeamDeflection />
                </TabsContent>
             </Tabs>
          </TabsContent>

          <TabsContent value="conversion" className="mt-0 outline-none">
            <UnitConversion />
          </TabsContent>

          <TabsContent value="contact" className="mt-0 outline-none">
            <ContactForm />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="py-16 border-t border-slate-900 bg-slate-950">
        <div className="container mx-auto px-6 space-y-12">
          {/* Disclaimer Section */}
          <div className="bg-slate-900/50 border-2 border-slate-800 rounded-[3rem] p-8 md:p-12 max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-8 shadow-inner">
            <div className="bg-amber-500/10 p-4 rounded-3xl border border-amber-500/20">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
            </div>
            <div className="space-y-4 text-center md:text-left">
              <h4 className="text-lg font-black text-amber-500 uppercase tracking-tighter italic">Important Disclaimer</h4>
              <p className="text-slate-400 text-sm font-bold leading-relaxed">
                StrucTCalc is currently <span className="text-white">under development</span>. Results generated by this application are <span className="text-white underline">not verified</span> and are intended for <span className="text-sky-400">study and research purposes only</span>. It must not be used for commercial, professional, or real-world engineering projects. 
              </p>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">
                The author accepts no responsibility for any harm, damage, or loss resulting from the use of this tool. For professional engineering tasks, always consult a licensed engineer and verified commercial software.
              </p>
              <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-4">
                <a 
                  href="https://github.com/sumonrh/StructCalc" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-slate-700 shadow-xl"
                >
                  <Github className="h-4 w-4" /> Contribute on GitHub
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 text-center">
            <p className="text-sm font-black text-slate-600 uppercase tracking-[0.3em]">
              StrucTCalc Engineering Suite © {new Date().getFullYear()}
            </p>
            <p className="text-[10px] text-slate-700 font-bold max-w-xs uppercase leading-loose">
              Built with precision and high-performance components by{' '}
              <a
                href="https://firebase.google.com/studio"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-sky-500 hover:text-sky-400 underline underline-offset-4"
              >
                Firebase Studio
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

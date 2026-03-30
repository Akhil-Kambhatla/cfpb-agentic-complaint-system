"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  letter: string;
}

export default function ResolutionLetter({ letter }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-medium text-slate-200">Customer Response Letter</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 mx-4 mb-4 mt-0">
              <div className="mt-3 rounded-lg bg-slate-100 p-5 font-serif text-slate-900 text-sm leading-relaxed whitespace-pre-wrap shadow-inner">
                {letter}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

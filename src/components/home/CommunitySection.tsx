"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { MessageSquare, Star, Twitter, Linkedin, Github } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const forumDiscussions = [
  { id: 1, title: "Having trouble with RAL backdoor access", author: "dv_guru", replies: 12, href: "/community/post/1" },
  { id: 2, title: "Best way to model a complex scoreboard?", author: "verifier_viv", replies: 8, href: "/community/post/2" },
  { id: 3, title: "UVM Phasing: `run_phase` vs `main_phase`", author: "rtl_rockstar", replies: 25, href: "/community/post/3" },
];

const topContributors = [
  { id: 1, name: "Alex Johnson", points: 1250, avatar: "/avatars/01.png" },
  { id: 2, name: "Maria Garcia", points: 1100, avatar: "/avatars/02.png" },
  { id: 3, name: "David Chen", points: 980, avatar: "/avatars/03.png" },
];

const CommunitySection = () => {
  return (
    <section className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Join Our Thriving Community</h2>
          <p className="text-lg text-foreground/80 max-w-3xl mx-auto">
            Learning is better together. Connect with thousands of fellow engineers, share knowledge, and grow your skills.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <motion.div
            className="lg:col-span-2 bg-card p-6 rounded-xl border"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center"><MessageSquare className="mr-2 text-primary"/> Recent Discussions</h3>
            <ul className="space-y-2">
              {forumDiscussions.map(d => (
                <li key={d.id} className="transition-colors hover:bg-muted -mx-2 px-2 py-2 rounded-lg">
                  <Link href={d.href} className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-primary">{d.title}</p>
                      <p className="text-sm text-muted-foreground">by {d.author}</p>
                    </div>
                    <span className="text-sm font-bold text-foreground/80 hidden sm:block">{d.replies} replies</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-6 w-full" asChild>
                <Link href="/community">Visit Forums</Link>
            </Button>
          </motion.div>

          <motion.div
            className="bg-card p-6 rounded-xl border"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center"><Star className="mr-2 text-amber-400"/> Top Contributors</h3>
            <ul className="space-y-4">
              {topContributors.map((c, i) => (
                <li key={c.id} className="flex items-center">
                  <span className="text-lg font-bold w-6 mr-2 text-muted-foreground">{i+1}.</span>
                  <Image src={c.avatar} alt={c.name} width={40} height={40} className="rounded-full mr-3" />
                  <div>
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.points.toLocaleString()} points</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.div
            className="mt-12 text-center"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7 }}
        >
            <h3 className="text-2xl font-bold text-foreground mb-2">Follow our Journey</h3>
            <p className="text-muted-foreground mb-6">Stay up to date with the latest news and content.</p>
            <div className="flex justify-center gap-6">
                <Link href="#" aria-label="Twitter" className="text-muted-foreground transition-colors hover:text-primary"><Twitter size={28} /></Link>
                <Link href="#" aria-label="LinkedIn" className="text-muted-foreground transition-colors hover:text-primary"><Linkedin size={28} /></Link>
                <Link href="#" aria-label="GitHub" className="text-muted-foreground transition-colors hover:text-primary"><Github size={28} /></Link>
            </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CommunitySection;

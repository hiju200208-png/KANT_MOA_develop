"use client";

import Image from "next/image";
import Link from "next/link";
import { STATUS_COPY, type StatusVariant } from "@/constants/status-copy";

type Action = {label:string;href:string} | {label:string;onClick:()=>void};
export function StatusView({variant,title,description,actions,compact=false}:{variant:StatusVariant;title?:string;description?:string;actions?:Action[];compact?:boolean}) {
 const data=STATUS_COPY[variant]; const buttons=actions??data.actions;
 return <section className={`flex w-full flex-col items-center justify-center rounded-2xl border border-[#e8e9eb] bg-white px-4 text-center shadow-sm ${compact?"py-8":"py-10 sm:py-14"}`} aria-labelledby={`status-${variant}`}>
  <Image src={data.image} alt="" width={512} height={512} priority={false} className={`h-auto w-full object-contain ${compact?"max-w-40":"max-w-52 sm:max-w-60"}`}/>
  <h2 id={`status-${variant}`} className="mt-3 text-lg font-black text-[#111214] sm:text-xl">{title??data.title}</h2>
  <p className="mt-2 max-w-sm break-keep text-sm leading-6 text-[#73767c]">{description??data.description}</p>
  {buttons.length>0&&<div className="mt-6 flex max-w-full flex-wrap justify-center gap-2">{buttons.map((action,i)=>{const className=`inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2 text-sm font-bold transition-colors ${i===0?"border-[#111214] bg-[#111214] text-white hover:bg-neutral-800":"border-[#e8e9eb] bg-white text-[#111214] hover:bg-neutral-50"}`;return "href" in action?<Link key={i} href={action.href} className={className}>{action.label}</Link>:<button key={i} type="button" onClick={action.onClick} className={className}>{action.label}</button>})}</div>}
 </section>;
}

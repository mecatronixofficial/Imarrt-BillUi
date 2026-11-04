import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
type Props={title:string;description?:string;action?:ReactNode;eyebrow?:string};
export default function PageHeader({title,description,action}:Props){return <header className="reference-page-header"><div className="flex min-w-0 items-center gap-2"><h1>{title}</h1><ChevronDown size={18}/></div>{description&&<p className="sr-only">{description}</p>}{action&&<div className="reference-page-action">{action}</div>}</header>}

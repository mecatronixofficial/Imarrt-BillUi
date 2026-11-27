'use client';

import { useEffect, useRef, type FormEvent } from 'react';
import { ArrowRight, Check, CircleAlert, LayoutList, Loader2, MapPin, Pencil, Plus, RefreshCw, Save, Search, Trash2, Warehouse, X } from 'lucide-react';
import InventoryNav from './InventoryNav';
import styles from './GodownsView.module.css';

export type Godown = { id: string; name: string; address?: string };

type Props = {
  godowns: Godown[];
  loading: boolean;
  saving: boolean;
  error: string;
  name: string;
  address: string;
  editing: string;
  query: string;
  onNameChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onSave: (event: FormEvent) => void;
  onRefresh: () => void;
  onEdit: (godown: Godown) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
};

export default function GodownsView({ godowns, loading, saving, error, name, address, editing, query, onNameChange, onAddressChange, onQueryChange, onSave, onRefresh, onEdit, onDelete, onReset }: Props) {
  const nameInput = useRef<HTMLInputElement>(null);
  const formPanel = useRef<HTMLElement>(null);
  const withAddress = godowns.filter((godown) => godown.address?.trim()).length;
  const visible = godowns.filter((godown) => `${godown.name} ${godown.address || ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  function focusForm() {
    formPanel.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    nameInput.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (editing) focusForm();
  }, [editing]);

  function addGodown() {
    onReset();
    focusForm();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.heroIcon}><Warehouse size={27} strokeWidth={1.7} aria-hidden="true" /></span>
          <div><p className={styles.eyebrow}>INVENTORY / LOCATIONS</p><h1>Godowns</h1><p className={styles.subtitle}>A place for every item. Manage all your storage locations here.</p></div>
        </div>
        <button type="button" className={styles.primaryButton} disabled={saving} onClick={addGodown}><Plus size={17} aria-hidden="true" /> Add godown</button>
      </header>

      <InventoryNav active="godowns" />

      <div className={styles.metrics} aria-label="Godown overview">
        <div className={styles.metric}><span className={styles.metricIcon}><Warehouse size={21} aria-hidden="true" /></span><div><span>Total godowns</span><strong>{loading ? '—' : godowns.length}</strong></div><small>Storage locations</small></div>
        <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.greenIcon}`}><MapPin size={21} aria-hidden="true" /></span><div><span>With an address</span><strong>{loading ? '—' : withAddress}</strong></div><small>Easy to locate</small></div>
        <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.amberIcon}`}><Pencil size={20} aria-hidden="true" /></span><div><span>Address to add</span><strong>{loading ? '—' : godowns.length - withAddress}</strong></div><small>Keep details complete</small></div>
      </div>

      {error && <div role="alert" className={styles.error}><CircleAlert size={19} aria-hidden="true" /><p>{error}</p><button type="button" className={styles.secondaryButton} disabled={loading || saving} onClick={onRefresh}><RefreshCw size={15} aria-hidden="true" /> Retry</button></div>}

      <div className={styles.workspace}>
        <section ref={formPanel} className={styles.formPanel} aria-labelledby="godown-form-heading">
          <div className={styles.panelHeading}><span className={styles.formIcon}>{editing ? <Pencil size={19} aria-hidden="true" /> : <Plus size={21} aria-hidden="true" />}</span><div><h2 id="godown-form-heading">{editing ? 'Edit godown' : 'Add a godown'}</h2><p>{editing ? 'Update your storage location details.' : 'Make room for your next location.'}</p></div></div>
          <form onSubmit={onSave}>
            <fieldset disabled={saving} className={styles.fields}>
              <label htmlFor="godown-name">Godown name <span className={styles.required}>*</span></label>
              <input ref={nameInput} id="godown-name" required maxLength={100} placeholder="e.g. Main warehouse" value={name} onChange={(event) => onNameChange(event.target.value)} />
              <label htmlFor="godown-address">Address <span className={styles.optional}>Optional</span></label>
              <textarea id="godown-address" maxLength={2000} rows={4} placeholder="Street, area, city and PIN code" value={address} onChange={(event) => onAddressChange(event.target.value)} />
              <p className={styles.fieldHint}><MapPin size={13} aria-hidden="true" /> Add an address to help your team find it.</p>
            </fieldset>
            <div className={styles.formActions}><button type="submit" className={styles.primaryButton} disabled={saving || !name.trim()}>{saving ? <Loader2 size={16} className={styles.spin} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? 'Saving...' : editing ? 'Save changes' : 'Save godown'}{!saving && <ArrowRight size={16} aria-hidden="true" />}</button>{editing && <button type="button" className={styles.secondaryButton} disabled={saving} onClick={onReset}><X size={15} aria-hidden="true" /> Cancel edit</button>}</div>
          </form>
          <div className={styles.formNote}><span><Check size={14} aria-hidden="true" /></span><p>Your godowns stay connected to the selected company and branch.</p></div>
        </section>

        <section aria-labelledby="current-godowns-heading" aria-busy={loading} className={styles.listPanel}>
          <div className={styles.listHeading}><div><div className={styles.titleRow}><h2 id="current-godowns-heading">Current godowns</h2><span className={styles.count}>{loading ? '—' : godowns.length}</span></div><p>Your storage locations, all in one place.</p></div><button type="button" className={styles.secondaryButton} disabled={loading || saving} onClick={onRefresh}><RefreshCw size={15} className={loading ? styles.spin : undefined} aria-hidden="true" /><span>Refresh</span></button></div>
          <div className={styles.searchBar}><div className={styles.searchField}><Search size={17} aria-hidden="true" /><input aria-label="Search godowns" placeholder="Search by name or address..." value={query} onChange={(event) => onQueryChange(event.target.value)} />{query && <button type="button" aria-label="Clear godown search" onClick={() => onQueryChange('')}><X size={15} aria-hidden="true" /></button>}</div><span className={styles.listLabel}><LayoutList size={15} aria-hidden="true" /> Locations</span></div>

          {loading ? <div className={styles.loading} role="status"><Loader2 size={23} className={styles.spin} aria-hidden="true" /><p>Loading godowns...</p></div> : godowns.length === 0 ? <div className={styles.empty} role="status"><span><Warehouse size={31} strokeWidth={1.5} aria-hidden="true" /></span><h3>{error ? 'Unable to load godowns' : 'Your first godown starts here'}</h3><p>{error ? 'Godowns could not be loaded. Use Retry to try again.' : 'No godowns yet. Add your first godown using the form.'}</p>{!error && <button type="button" className={styles.secondaryButton} disabled={saving} onClick={addGodown}><Plus size={16} aria-hidden="true" /> Add your first godown</button>}</div> : visible.length === 0 ? <div className={styles.empty} role="status"><span><Search size={28} aria-hidden="true" /></span><h3>No godowns match your search.</h3><p>Try another name or address.</p><button type="button" className={styles.secondaryButton} onClick={() => onQueryChange('')}>Clear search</button></div> : <>
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th scope="col">GODOWN NAME</th><th scope="col">ADDRESS</th><th scope="col">ACTIONS</th></tr></thead><tbody>{visible.map((godown) => <tr key={godown.id} data-editing={editing === godown.id || undefined}><td><div className={styles.locationName}><span className={styles.locationIcon}><Warehouse size={19} strokeWidth={1.7} aria-hidden="true" /></span><div><strong>{godown.name}</strong><small>{editing === godown.id ? 'Editing this location' : 'Storage location'}</small></div></div></td><td><div className={`${styles.address} ${!godown.address?.trim() ? styles.missingAddress : ''}`}><MapPin size={14} aria-hidden="true" /><span>{godown.address?.trim() || 'No address added'}</span></div></td><td><div className={styles.rowActions}><button type="button" className={styles.editButton} disabled={saving} aria-label={`Edit ${godown.name}`} onClick={() => { onEdit(godown); if (editing === godown.id) focusForm(); }}><Pencil size={14} aria-hidden="true" /><span>Edit</span></button><button type="button" className={styles.deleteButton} disabled={saving} aria-label={`Delete ${godown.name}`} onClick={() => onDelete(godown.id)}><Trash2 size={14} aria-hidden="true" /><span>Delete</span></button></div></td></tr>)}</tbody></table></div>
            <footer className={styles.listFooter}><span>Showing <strong>{visible.length}</strong> of <strong>{godowns.length}</strong> godowns</span><span><Warehouse size={13} aria-hidden="true" /> Organised spaces. Better stock control.</span></footer>
          </>}
        </section>
      </div>
    </div>
  );
}

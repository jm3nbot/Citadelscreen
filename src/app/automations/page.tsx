"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useCitadel } from "@/lib/store";
import { formatRelativeTime, cn } from "@/lib/utils";
import { Plus, Trash2, Zap, X } from "lucide-react";
import type { Automation } from "@/lib/types";

const categories: Array<{ id: Automation["category"]; label: string }> = [
  { id: "ai", label: "AI" },
  { id: "email", label: "Email" },
  { id: "reports", label: "Reports" },
  { id: "files", label: "Files" },
  { id: "calendar", label: "Calendar" },
  { id: "tasks", label: "Tasks" },
];

const appOptions = [
  "gmail", "calendar", "drive", "notion", "claude", "chatgpt", "n8n", "tasks", "reminders", "github", "slack",
];

export default function AutomationsPage() {
  const automations = useCitadel((s) => s.automations);
  const triggerAutomation = useCitadel((s) => s.triggerAutomation);
  const addAutomation = useCitadel((s) => s.addAutomation);
  const deleteAutomation = useCitadel((s) => s.deleteAutomation);

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    webhookUrl: "",
    category: "ai" as Automation["category"],
    connectedAppIds: [] as string[],
  });
  const [toast, setToast] = useState<string | null>(null);

  function submit() {
    if (!form.name.trim()) return;
    addAutomation({
      name: form.name,
      description: form.description || "Custom automation.",
      category: form.category,
      webhookUrl: form.webhookUrl || undefined,
      connectedAppIds: form.connectedAppIds,
    });
    setForm({ name: "", description: "", webhookUrl: "", category: "ai", connectedAppIds: [] });
    setShowNew(false);
  }

  function handleTrigger(a: Automation) {
    triggerAutomation(a.id);
    setToast(`Triggered “${a.name}” · webhook ${a.webhookUrl ? "called" : "stubbed"}`);
    setTimeout(() => setToast(null), 2200);
  }

  return (
    <div className="h-full overflow-auto bg-dot-grid">
      <div className="mx-auto max-w-[1400px] px-6 py-7">
        <PageHeader
          tag="automations · n8n"
          title="Your workflow surface."
          subtitle="Wire any n8n webhook into Citadel. Each automation becomes a one-tap action across the app."
          right={
            <Button
              variant="primary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setShowNew((s) => !s)}
            >
              New automation
            </Button>
          }
        />

        {showNew && (
          <Card className="mb-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Summarize unread emails"
                  className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
                />
              </Field>
              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Automation["category"] })}
                  className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-white focus:border-accent/40 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description" full>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short note on what it does and when it runs."
                  className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
                />
              </Field>
              <Field label="Webhook URL" full>
                <input
                  value={form.webhookUrl}
                  onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                  placeholder="https://n8n.your-domain/webhook/…"
                  className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
                />
              </Field>
              <Field label="Connected apps" full>
                <div className="flex flex-wrap gap-1.5">
                  {appOptions.map((id) => {
                    const active = form.connectedAppIds.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            connectedAppIds: active
                              ? form.connectedAppIds.filter((x) => x !== id)
                              : [...form.connectedAppIds, id],
                          })
                        }
                        className={cn(
                          "rounded-md border px-2 py-1 text-[10.5px] tracking-tight transition-colors",
                          active
                            ? "border-accent/30 bg-accent/[0.08] text-white"
                            : "border-white/[0.06] bg-white/[0.02] text-muted hover:text-white"
                        )}
                      >
                        {id}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="subtle" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button variant="primary" onClick={submit}>Create automation</Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {automations.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mono-tag">{a.category}</div>
                  <h3 className="mt-1 text-[14px] font-medium tracking-tight text-white">
                    {a.name}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-muted">{a.description}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Zap className="h-3 w-3" />}
                    onClick={() => handleTrigger(a)}
                  >
                    Trigger
                  </Button>
                  <Button
                    size="sm"
                    variant="subtle"
                    icon={<Trash2 className="h-3 w-3" />}
                    onClick={() => deleteAutomation(a.id)}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[10.5px] text-muted-soft">
                <div className="flex gap-1.5">
                  {a.connectedAppIds.slice(0, 4).map((id) => {
                    const iconMap: Record<string, string> = {
                      gmail: "Mail",
                      calendar: "Calendar",
                      drive: "HardDrive",
                      notion: "BookOpen",
                      claude: "BrainCircuit",
                      chatgpt: "Sparkles",
                      n8n: "Workflow",
                      tasks: "CheckSquare",
                      reminders: "Bell",
                      github: "GitBranch",
                      slack: "MessageSquare",
                    };
                    return (
                      <div
                        key={id}
                        title={id}
                        className="flex h-5 w-5 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]"
                      >
                        <Icon name={iconMap[id] ?? "Hexagon"} className="h-2.5 w-2.5 text-white/80" />
                      </div>
                    );
                  })}
                </div>
                <div>
                  {a.runs ?? 0} runs · {a.lastRunAt ? `last ${formatRelativeTime(a.lastRunAt)}` : "never"}
                </div>
              </div>

              {a.webhookUrl && (
                <div className="mt-3 truncate rounded-md border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5 font-mono text-[10.5px] text-muted">
                  {a.webhookUrl}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-accent/25 bg-ink-100/90 px-4 py-2 text-[12px] text-white shadow-glow backdrop-blur-md">
            <Zap className="h-3.5 w-3.5 text-accent" />
            {toast}
            <button onClick={() => setToast(null)} className="ml-2 text-muted-soft hover:text-white">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="mono-tag mb-1.5">{label}</div>
      {children}
    </div>
  );
}

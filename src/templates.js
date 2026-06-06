export const TEMPLATES = {
  crm: {
    id: "crm-app",
    name: "CRM Lead Tracker",
    config: {
      name: "CRM Lead Tracker",
      theme: "dark",
      tables: [
        {
          name: "leads",
          fields: [
            { id: "name", type: "text", label: "Full Name" },
            { id: "email", type: "email", label: "Email Address" },
            { id: "company", type: "text", label: "Company" },
            { id: "status", type: "select", label: "Lead Status", options: ["New", "Contacted", "Qualified", "Closed Lost", "Closed Won"] },
            { id: "value", type: "number", label: "Deal Value ($)" }
          ]
        }
      ],
      pages: [
        {
          id: "dashboard",
          title: "Leads Dashboard",
          components: [
            {
              id: "stats-header",
              type: "text_block",
              content: "### Sales Pipeline overview\nMonitor your leads, deal stages, and values in real-time."
            },
            {
              id: "leads-table",
              type: "table_view",
              table: "leads"
            }
          ]
        },
        {
          id: "add-lead",
          title: "Capture Lead",
          components: [
            {
              id: "lead-form",
              type: "form_view",
              table: "leads",
              successMessage: "Lead successfully recorded in pipeline."
            }
          ]
        }
      ],
      workflows: [
        {
          id: "wf-new-lead",
          name: "Trigger New Lead Alert",
          trigger: { type: "on_create", table: "leads" },
          actions: [
            { type: "send_notification", message: "New Lead Capture: {{data.name}} from {{data.company}} for ${{data.value}}", notificationType: "success" },
            { type: "call_webhook", url: "https://httpbin.org/post", payload: { alert: "New Lead Registered", email: "{{data.email}}" } }
          ]
        },
        {
          id: "wf-update-lead",
          name: "Notify Deal Won",
          trigger: { type: "on_update", table: "leads" },
          actions: [
            { type: "send_notification", message: "Deal Status changed for {{data.name}} - status: {{data.status}}", notificationType: "info" }
          ]
        }
      ]
    }
  },
  helpdesk: {
    id: "helpdesk-app",
    name: "IT Support Helpdesk",
    config: {
      name: "IT Support Helpdesk",
      theme: "dark",
      tables: [
        {
          name: "tickets",
          fields: [
            { id: "title", type: "text", label: "Issue Title" },
            { id: "reporter", type: "text", label: "Reported By" },
            { id: "category", type: "select", label: "Category", options: ["Hardware", "Software", "Network", "Access Control"] },
            { id: "priority", type: "select", label: "Priority", options: ["Low", "Medium", "High", "Critical"] },
            { id: "status", type: "select", label: "Ticket Status", options: ["Open", "In Progress", "Resolved"] }
          ]
        }
      ],
      pages: [
        {
          id: "tickets-list",
          title: "Active Tickets",
          components: [
            {
              id: "tickets-table",
              type: "table_view",
              table: "tickets"
            }
          ]
        },
        {
          id: "create-ticket",
          title: "File Support Ticket",
          components: [
            {
              id: "ticket-form",
              type: "form_view",
              table: "tickets",
              successMessage: "Your support ticket has been queued. An engineer will follow up shortly."
            }
          ]
        }
      ],
      workflows: [
        {
          id: "wf-ticket-create",
          name: "Critical Alert Workflow",
          trigger: { type: "on_create", table: "tickets" },
          actions: [
            { type: "send_notification", message: "Support ticket registered: [{{data.priority}}] {{data.title}}", notificationType: "warning" },
            { type: "delay", duration: 1500 },
            { type: "send_notification", message: "Assigned default engineer to Ticket ID: {{data._id}}", notificationType: "info" }
          ]
        }
      ]
    }
  }
};

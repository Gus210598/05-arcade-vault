import { Resend } from "resend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TO_EMAIL = "gustavo.barahona.i@gmail.com";

type ContactPayload = {
  name: string;
  email: string;
  message: string;
  honeypot: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ContactPayload>;
  const { name, email, message, honeypot } = body;

  if (honeypot) {
    return Response.json({ ok: true });
  }

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return Response.json(
      { ok: false, error: "Todos los campos son obligatorios." },
      { status: 400 }
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return Response.json(
      { ok: false, error: "El formato del email no es válido." },
      { status: 400 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: TO_EMAIL,
    replyTo: email,
    subject: "Nuevo mensaje de contacto — Arcade Vault",
    text: `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`,
  });

  if (error) {
    return Response.json(
      { ok: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}

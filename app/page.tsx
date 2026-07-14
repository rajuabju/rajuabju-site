import Image from "next/image";
import ContactForm from "./components/ContactForm";
import { FacebookIcon, RedditIcon, InstagramIcon, XIcon } from "./components/Icons";

const LINKS = [
  { label: "Facebook", href: "https://facebook.com/rajuabju", Icon: FacebookIcon },
  { label: "Instagram", href: "https://instagram.com/rajuabju", Icon: InstagramIcon },
  { label: "X / Twitter", href: "https://x.com/rajuabju", Icon: XIcon },
  { label: "Reddit", href: "https://reddit.com/u/rajuabju", Icon: RedditIcon },
];

export default function Home() {
  return (
    <main>
      <Image
        className="avatar"
        src="/ra-mark.png"
        alt="rajuabju"
        width={84}
        height={84}
        priority
      />
      <h1>rajuabju</h1>
      <p className="tagline">
        &ldquo;My style is impetuous, my defense is impregnable, and I&rsquo;m
        just ferocious. I&rsquo;m the best ever.&rdquo;
      </p>

      <nav className="links" aria-label="Social links">
        {LINKS.map(({ label, href, Icon }) => (
          <a
            key={label}
            className="link-btn"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon />
            {label}
          </a>
        ))}
      </nav>

      <div className="divider">Get in touch</div>

      <div className="contact-card">
        <p className="lead">
          Send a message and it&rsquo;ll land straight in my inbox.
        </p>
        <ContactForm />
      </div>

      <footer>
        &copy; {new Date().getFullYear()} rajuabju &mdash; <em>The One &amp; Only</em>
      </footer>
    </main>
  );
}

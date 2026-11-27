export const clubFacebook = "https://www.facebook.com/klub.na.nastavnici";
export const clubInstagram = "https://www.instagram.com/klubnanastavnici/";

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 8.25H17V5h-2.5C11.57 5 9.5 7.07 9.5 9.5V12H7v3.25h2.5V22H13v-6.75h2.4l.6-3.25H13V9.5c0-.69.56-1.25 1.5-1.25Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3.5h8A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16V8A4.5 4.5 0 0 1 8 3.5Zm0 1.75A2.75 2.75 0 0 0 5.25 8v8A2.75 2.75 0 0 0 8 18.75h8A2.75 2.75 0 0 0 18.75 16V8A2.75 2.75 0 0 0 16 5.25H8Zm8.15 1.35a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1ZM12 8.25A3.75 3.75 0 1 1 8.25 12 3.75 3.75 0 0 1 12 8.25Zm0 1.75A2 2 0 1 0 14 12a2 2 0 0 0-2-2Z" />
    </svg>
  );
}

export function ClubSocialIcons() {
  return (
    <div className="club-social-icons">
      <a href={clubFacebook} target="_blank" rel="noreferrer" aria-label="Facebook на Клубот">
        <FacebookIcon />
      </a>
      <a href={clubInstagram} target="_blank" rel="noreferrer" aria-label="Instagram на Клубот">
        <InstagramIcon />
      </a>
    </div>
  );
}

export default function ClubSocials({ compact = false }) {
  return (
    <div className={compact ? "club-socials is-compact" : "club-socials"}>
      <p>Следете го Клубот</p>
      <ClubSocialIcons />
    </div>
  );
}

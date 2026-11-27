export const clubFacebook = "https://www.facebook.com/klub.na.nastavnici";
export const clubInstagram = "https://www.instagram.com/klubnanastavnici/";

export default function ClubSocials({ compact = false }) {
  return (
    <div className={compact ? "club-socials is-compact" : "club-socials"}>
      <p>Следете го Клубот</p>
      <a href={clubFacebook} target="_blank" rel="noreferrer">Facebook</a>
      <a href={clubInstagram} target="_blank" rel="noreferrer">Instagram</a>
    </div>
  );
}

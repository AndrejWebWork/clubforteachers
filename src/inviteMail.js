export function browserMailLinks(mail) {
  const to = encodeURIComponent(mail.to);
  const subject = encodeURIComponent(mail.subject);
  const body = encodeURIComponent(mail.body);
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`,
    outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${body}`,
  };
}

export function isGmailAddress(email) {
  return /@(gmail|googlemail)\.com$/i.test(String(email || "").trim());
}

export function deliverInvite(mail, tab) {
  const links = { to: mail.to, from: mail.from, ...browserMailLinks(mail) };
  if (isGmailAddress(mail.from) && tab) {
    tab.location.href = links.gmail;
    return { opened: true, links };
  }
  if (tab && !tab.closed) tab.close();
  return { opened: false, links };
}

import { StaticPage } from "@/components/static-page";

export const metadata = { title: "Community rules" };

export default function RulesPage() {
  return (
    <StaticPage title="Community rules">
      <p>Pbs Go is a space for students at our school to meet people who like the same things. To keep it safe and friendly for everyone:</p>
      <h2>Be kind</h2>
      <ul>
        <li>No bullying, insults, threats, or making fun of anyone.</li>
        <li>No hate about anyone&apos;s religion, family, background, looks or abilities.</li>
        <li>No swearing or rude content. Our filter hides posts and messages with bad words until a moderator checks them.</li>
      </ul>
      <h2>Be yourself</h2>
      <ul>
        <li>Your real name is shown on everything you post. There is no anonymous posting.</li>
        <li>Don&apos;t pretend to be someone else.</li>
      </ul>
      <h2>Keep private things private</h2>
      <ul>
        <li>Don&apos;t share phone numbers, addresses, passwords or photos of other people without asking them.</li>
        <li>Don&apos;t screenshot private chats to embarrass anyone.</li>
      </ul>
      <h2>Buying, selling and swapping</h2>
      <ul>
        <li>Meet only at school, during the school day. No online payments.</li>
        <li>Only sell things that are yours and allowed at school. No food, medicine, phones that aren&apos;t yours, or anything dangerous.</li>
      </ul>
      <h2>Points, challenges and volunteering</h2>
      <ul>
        <li>Be honest about challenges and volunteering hours — moderators check them, and false entries are removed.</li>
        <li>Points add up for your grade. Nobody else can see your own points.</li>
      </ul>
      <h2>Speak up</h2>
      <ul>
        <li>Every post, message, profile, club and event has a <strong>Report</strong> button. Reports are private — the person you report is not told who reported them.</li>
        <li>If someone bothers you in private messages, you can <strong>block</strong> them from their profile.</li>
        <li>If you or a friend is not OK, tell a teacher or counselor you trust, use the report reason &quot;Someone may need help&quot;, or tap <strong>Talk to the counselor</strong> on the More page. Only you and the counselor can read those messages.</li>
      </ul>
      <h2>What happens if rules are broken</h2>
      <p>Moderators can remove content and suspend accounts for 1, 7 or 30 days. School admins can remove accounts. Every action is recorded.</p>
    </StaticPage>
  );
}

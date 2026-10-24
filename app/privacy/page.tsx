import { StaticPage } from "@/components/static-page";

export const metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy notice">
      <p>This page explains, in plain words, what Pbs Go stores and who can see it.</p>
      <h2>Who can use Pbs Go</h2>
      <p>Only students who sign in with their school Google account. Nothing on Pbs Go is public, and search engines are told not to list it.</p>
      <h2>What we store</h2>
      <ul>
        <li>Your name and school email (from your school Google account).</li>
        <li>Your grade, the avatar you picked, your short bio and interests.</li>
        <li>Clubs you join, events you RSVP to, and what you post and send.</li>
        <li>Reports you send, and moderation actions.</li>
        <li>Tutoring requests, marketplace listings, Tawjihi questions and answers, suggestions, challenge entries and volunteering hours.</li>
        <li>Your points and badges, and which polls and elections you voted in (but other people can&apos;t see what you chose).</li>
        <li>Messages you send to the school counselor.</li>
      </ul>
      <p>We do <strong>not</strong> collect phone numbers, home addresses, birthdays, your location or your Google profile photo.</p>
      <h2>Who can see what</h2>
      <ul>
        <li><strong>Students at your school</strong> see your name, grade, avatar, bio, interests, clubs and posts. Students at other schools see nothing.</li>
        <li><strong>Private messages</strong> are seen only by the people in the chat. If a message is reported, a copy of that one message is shown to school admins.</li>
        <li><strong>School admins</strong> can see students&apos; email addresses to manage accounts.</li>
        <li><strong>Your points</strong> are only visible to you. The leaderboard shows totals per grade, never per student.</li>
        <li><strong>Votes</strong> are secret. Nobody can see who you voted for.</li>
        <li><strong>Counselor messages</strong> can only be read by you and the school counselor — not by admins or moderators.</li>
        <li><strong>Suggestions</strong> are read by the student council and school admins.</li>
      </ul>
      <h2>Where it is stored</h2>
      <p>Data is stored securely with Supabase (a database service) on servers in the EU. Only the school&apos;s Pbs Go team can manage it.</p>
      <h2>Leaving</h2>
      <p>When students leave the school, their accounts are removed. Ask your school admin if you want your account deleted sooner.</p>
    </StaticPage>
  );
}

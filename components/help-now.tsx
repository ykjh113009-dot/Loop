// Shown on the counselor pages: what to do if someone is in danger right now.
export function HelpNow() {
  return (
    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
      <p className="font-semibold">In danger right now?</p>
      <p>
        Tell an adult near you straight away. You can also call the free <strong>Sawa helpline 121</strong> or an
        ambulance on <strong>101</strong>.
      </p>
    </div>
  );
}

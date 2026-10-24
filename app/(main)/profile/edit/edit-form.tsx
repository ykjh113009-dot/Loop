"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/profile";
import { ProfileFields } from "@/components/profile-fields";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

export function EditProfileForm(props: {
  interests: { id: number; name: string; emoji: string }[];
  avatar: string;
  bio: string;
  picked: number[];
  mentor?: { university: string; major: string } | null;
}) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="card space-y-6 p-4">
      <ProfileFields interests={props.interests} defaultAvatar={props.avatar} defaultBio={props.bio} defaultInterests={props.picked} />
      {props.mentor && (
        <fieldset className="space-y-2">
          <legend className="label">Alumni mentor details (shown in the Tawjihi corner)</legend>
          <input name="university" maxLength={80} defaultValue={props.mentor.university} placeholder="University" className="input" />
          <input name="major" maxLength={80} defaultValue={props.mentor.major} placeholder="What you study" className="input" />
        </fieldset>
      )}
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">Save</SubmitButton>
    </form>
  );
}

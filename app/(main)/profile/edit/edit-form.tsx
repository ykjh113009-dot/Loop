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
}) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="card space-y-6 p-4">
      <ProfileFields interests={props.interests} defaultAvatar={props.avatar} defaultBio={props.bio} defaultInterests={props.picked} />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">Save</SubmitButton>
    </form>
  );
}

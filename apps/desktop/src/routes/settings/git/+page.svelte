<script lang="ts">
	import { GitConfigService } from '$lib/backend/gitConfigService';
	import SettingsPage from '$lib/layout/SettingsPage.svelte';
	import Link from '$lib/shared/Link.svelte';
	import { getContext } from '@gitbutler/shared/context';
	import SectionCard from '@gitbutler/ui/SectionCard.svelte';
	import Toggle from '@gitbutler/ui/Toggle.svelte';
	import { onMount } from 'svelte';

	const gitConfig = getContext(GitConfigService);

	let annotateCommits = $state(true);

	function toggleCommitterSigning() {
		annotateCommits = !annotateCommits;
		gitConfig.set('gitbutler.gitbutlerCommitter', annotateCommits ? '1' : '0');
	}

	onMount(async () => {
		annotateCommits = (await gitConfig.get('gitbutler.gitbutlerCommitter')) === '1';
	});
</script>

<SettingsPage title="Git stuff">
	<SectionCard labelFor="committerSigning" orientation="row">
		{#snippet title()}
			Credit GitButler as the committer
		{/snippet}
		{#snippet caption()}
			By default, everything in the GitButler client is free to use. You can opt in to crediting us
			as the committer in your virtual branch commits to help spread the word.
			<Link
				target="_blank"
				rel="noreferrer"
				href="https://docs.gitbutler.com/features/virtual-branches/committer-mark"
			>
				Learn more
			</Link>
		{/snippet}
		{#snippet actions()}
			<Toggle id="committerSigning" checked={annotateCommits} onclick={toggleCommitterSigning} />
		{/snippet}
	</SectionCard>
</SettingsPage>

import 'reflect-metadata';
import { splitMessage } from '$lib/utils/commitMessage';
import { hashCode } from '$lib/utils/string';
import { isDefined, notNull } from '$lib/utils/typeguards';
import { Type, Transform } from 'class-transformer';

export type ChangeType =
	/// Entry does not exist in old version
	| 'added'
	/// Entry does not exist in new version
	| 'deleted'
	/// Entry content changed between old and new
	| 'modified';

export class Hunk {
	id!: string;
	diff!: string;
	@Transform((obj) => {
		return new Date(obj.value);
	})
	modifiedAt!: Date;
	filePath!: string;
	hash?: string;
	locked!: boolean;
	lockedTo!: string[] | undefined;
	changeType!: ChangeType;
}

export type AnyFile = LocalFile | RemoteFile;

export class LocalFile {
	id!: string;
	path!: string;
	@Type(() => Hunk)
	hunks!: Hunk[];
	expanded?: boolean;
	@Transform((obj) => new Date(obj.value))
	modifiedAt!: Date;
	// This indicates if a file has merge conflict markers generated and not yet resolved.
	// This is true for files after a branch which does not apply cleanly (Branch.isMergeable == false) is applied.
	// (therefore this field is applicable only for the workspace, i.e. active == true)
	conflicted!: boolean;
	content!: string;
	binary!: boolean;
	large!: boolean;

	get filename(): string {
		const parts = this.path.split('/');
		return parts[parts.length - 1];
	}

	get justpath() {
		return this.path.split('/').slice(0, -1).join('/');
	}

	get hunkIds() {
		return this.hunks.map((h) => h.id);
	}

	get locked(): boolean {
		return this.hunks
			? this.hunks.map((hunk) => hunk.locked).reduce((a, b) => !!(a || b), false)
			: false;
	}

	get lockedIds(): string[] {
		return this.hunks
			.flatMap((hunk) => hunk.lockedTo)
			.filter(notNull)
			.filter(isDefined);
	}
}

export class SkippedFile {
	oldPath!: string | undefined;
	newPath!: string | undefined;
	binary!: boolean;
	oldSizeBytes!: number;
	newSizeBytes!: number;
}

export class VirtualBranches {
	@Type(() => Branch)
	branches!: Branch[];
	@Type(() => SkippedFile)
	skippedFiles!: SkippedFile[];
}

export class Branch {
	id!: string;
	name!: string;
	notes!: string;
	// Active means the branch has been applied to the workspace
	active!: boolean;
	@Type(() => LocalFile)
	files!: LocalFile[];
	@Type(() => Commit)
	commits!: Commit[];
	requiresForce!: boolean;
	description!: string;
	order!: number;
	@Type(() => RemoteBranch)
	upstream?: RemoteBranch;
	upstreamName?: string;
	conflicted!: boolean;
	// TODO: to be removed from the API
	baseCurrent!: boolean;
	ownership!: string;
	// This should actually be named "canBeCleanlyApplied" - if it's false, applying this branch will generate conflict markers,
	// but it's totatlly okay for a user to apply it.
	// If the branch has been already applied, then it was either performed cleanly or we generated conflict markers in the diffs.
	// (therefore this field is applicable for stashed/unapplied or remote branches, i.e. active == false)
	isMergeable!: Promise<boolean>;
	@Transform((obj) => new Date(obj.value))
	updatedAt!: Date;
	// Indicates that branch is default target for new changes
	selectedForChanges!: boolean;

	get localCommits() {
		return this.commits.filter((c) => c.status == 'local');
	}

	get remoteCommits() {
		return this.commits.filter((c) => c.status == 'remote');
	}

	get integratedCommits() {
		return this.commits.filter((c) => c.status == 'integrated');
	}
}

// Used for dependency injection
export const BRANCH = Symbol('branch');
export type ComponentStyleKind = 'solid' | 'soft';
export type ComponentColor =
	| 'neutral'
	| 'ghost'
	| 'pop'
	| 'success'
	| 'error'
	| 'warning'
	| 'purple';
export type CommitStatus = 'local' | 'remote' | 'integrated' | 'upstream';

export class Commit {
	id!: string;
	author!: Author;
	description!: string;
	@Transform((obj) => new Date(obj.value))
	createdAt!: Date;
	isRemote!: boolean;
	isIntegrated!: boolean;
	@Type(() => LocalFile)
	files!: LocalFile[];
	parentIds!: string[];
	branchId!: string;

	get isLocal() {
		return !this.isRemote && !this.isIntegrated;
	}

	get status() {
		if (!this.isIntegrated && !this.isRemote) {
			return 'local';
		} else if (!this.isIntegrated && this.isRemote) {
			return 'remote';
		} else if (this.isIntegrated) {
			return 'integrated';
		}
	}

	get descriptionTitle(): string | undefined {
		return splitMessage(this.description).title || undefined;
	}

	get descriptionBody(): string | undefined {
		return splitMessage(this.description).description || undefined;
	}

	isParentOf(possibleChild: Commit) {
		return possibleChild.parentIds.includes(this.id);
	}
}

export class RemoteCommit {
	id!: string;
	author!: Author;
	description!: string;
	@Transform((obj) => new Date(obj.value * 1000))
	createdAt!: Date;

	get isLocal() {
		return false;
	}

	get descriptionTitle(): string | undefined {
		return splitMessage(this.description).title || undefined;
	}

	get descriptionBody(): string | undefined {
		return splitMessage(this.description).description || undefined;
	}
}

export type AnyCommit = Commit | RemoteCommit;

export const LOCAL_COMMITS = Symbol('LocalCommtis');
export const REMOTE_COMMITS = Symbol('RemoteCommits');
export const INTEGRATED_COMMITS = Symbol('IntegratedCommits');
export const UNKNOWN_COMMITS = Symbol('UnknownCommits');

export class RemoteHunk {
	diff!: string;
	hash?: string;

	get id(): string {
		return hashCode(this.diff);
	}

	get locked() {
		return false;
	}
}

export class RemoteFile {
	path!: string;
	@Type(() => RemoteHunk)
	hunks!: RemoteHunk[];
	binary!: boolean;

	get id(): string {
		return this.path;
	}

	get filename(): string {
		return this.path.replace(/^.*[\\/]/, '');
	}

	get justpath() {
		return this.path.split('/').slice(0, -1).join('/');
	}

	get large() {
		return false;
	}

	get conflicted() {
		return false;
	}

	get hunkIds() {
		return this.hunks.map((h) => h.id);
	}

	get lockedIds(): string[] {
		return [];
	}

	get locked(): boolean {
		return false;
	}
}

export interface Author {
	email?: string;
	name?: string;
	gravatarUrl?: URL;
	isBot?: boolean;
}

export class RemoteBranch {
	sha!: string;
	name!: string;
	upstream?: string;
	lastCommitTimestampMs?: number | undefined;
	lastCommitAuthor?: string | undefined;

	get displayName(): string {
		return this.name.replace('refs/remotes/', '').replace('origin/', '').replace('refs/heads/', '');
	}
}

export class RemoteBranchData {
	sha!: string;
	name!: string;
	upstream?: string;
	behind!: number;
	@Type(() => RemoteCommit)
	commits!: RemoteCommit[];
	isMergeable!: boolean | undefined;

	get ahead(): number {
		return this.commits.length;
	}

	get lastCommitTs(): Date | undefined {
		return this.commits[0]?.createdAt;
	}

	get firstCommitAt(): Date {
		return this.commits[this.commits.length - 1].createdAt;
	}

	get authors(): Author[] {
		const allAuthors = this.commits.map((commit) => commit.author);
		const uniqueAuthors = allAuthors.filter(
			(author, index) => allAuthors.findIndex((a) => a.email == author.email) == index
		);
		return uniqueAuthors;
	}

	get displayName(): string {
		return this.name.replace('refs/remotes/', '').replace('origin/', '').replace('refs/heads/', '');
	}
}

export class BaseBranch {
	branchName!: string;
	remoteName!: string;
	remoteUrl!: string;
	baseSha!: string;
	currentSha!: string;
	behind!: number;
	@Type(() => RemoteCommit)
	upstreamCommits!: RemoteCommit[];
	@Type(() => RemoteCommit)
	recentCommits!: RemoteCommit[];
	lastFetchedMs?: number;

	get lastFetched(): Date | undefined {
		return this.lastFetchedMs ? new Date(this.lastFetchedMs) : undefined;
	}

	get repoBaseUrl(): string {
		if (this.remoteUrl.startsWith('http')) {
			return this.remoteUrl.replace('.git', '');
		} else {
			return this.remoteUrl.replace(':', '/').replace('git@', 'https://').replace('.git', '');
		}
	}

	commitUrl(commitId: string): string | undefined {
		// Different Git providers use different paths for the commit url:
		if (this.isBitBucket) {
			return `${this.repoBaseUrl}/commits/${commitId}`;
		}
		if (this.isGitlab) {
			return `${this.repoBaseUrl}/-/commit/${commitId}`;
		}
		return `${this.repoBaseUrl}/commit/${commitId}`;
	}

	get shortName() {
		return this.branchName.split('/').slice(-1)[0];
	}

	branchUrl(upstreamBranchName: string | undefined) {
		if (!upstreamBranchName) return undefined;
		const baseBranchName = this.branchName.split('/')[1];
		const branchName = upstreamBranchName.split('/').slice(3).join('/');
		if (this.isBitBucket) {
			return `${this.repoBaseUrl.trim()}/branch/${branchName}?dest=${baseBranchName}`;
		}
		// The following branch path is good for at least Gitlab and Github:
		return `${this.repoBaseUrl.trim()}/compare/${baseBranchName}...${branchName}`;
	}

	private get isBitBucket(): boolean {
		return this.repoBaseUrl.includes('bitbucket.org');
	}

	private get isGitlab(): boolean {
		return this.repoBaseUrl.includes('gitlab.com');
	}
}

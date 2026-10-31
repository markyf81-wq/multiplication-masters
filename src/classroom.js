// Only used after a teacher chooses Import from Google Classroom and grants
// read-only roster access. Tokens live in this module's memory, never storage.
let accessToken = null;
let generation = 0;
let controller = null;

export function forgetClassroomAccess() {
  generation++;
  accessToken = null;
  controller?.abort();
  controller = null;
}

async function listPages(resource, query = {}) {
  if (!accessToken) throw new Error("Connect your teacher Google account to Classroom first.");
  const results = [];
  const activeGeneration = generation;
  const token = accessToken;
  const signal = controller?.signal;
  let pageToken = "";
  do {
    if (activeGeneration !== generation) throw new Error("The Classroom import was closed.");
    const url = new URL(`https://classroom.googleapis.com/v1/${resource}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (!response.ok) {
      if (response.status === 401) {
        forgetClassroomAccess();
        throw new Error("The Classroom connection expired. Connect again to refresh it.");
      }
      if (response.status === 403) throw new Error("Google Classroom access isn’t available. The project administrator needs to enable the Classroom API, and your school may need to allow roster access for this app.");
      throw new Error("Google Classroom couldn’t load the roster. Please try again.");
    }
    const page = await response.json();
    results.push(...(page.courses || page.students || []));
    pageToken = page.nextPageToken || "";
  } while (pageToken);
  return results;
}

export async function connectClassroom(cloud) {
  forgetClassroomAccess();
  const activeGeneration = generation;
  const token = await cloud.classroomAccessToken();
  if (activeGeneration !== generation) return [];
  accessToken = token;
  controller = new AbortController();
  return listPages("courses", { teacherId: "me", courseStates: "ACTIVE" });
}

export async function classroomRoster(courseId) {
  const students = await listPages(`courses/${encodeURIComponent(courseId)}/students`);
  return students.map(student => ({
    googleId: student.userId,
    nickname: student.profile?.name?.givenName || student.profile?.name?.fullName || "Student",
    email: (student.profile?.emailAddress || "").trim().toLowerCase(),
  }));
}

/*
 * College gap year (deferral) policies — researched 2026-11-24 from each college's own website.
 * Only facts a source states are included; anything not found is null.
 *
 * deferral:    "yes" | "case" (case-by-case, must be approved) | "no"
 * creditLevel: "none"    = no college credit / credit-bearing study allowed during the deferral
 *              "limited" = no degree-seeking or full-time enrollment elsewhere; some coursework may be OK
 *              "unclear" = the college's page doesn't say
 * grades:      what the college says about grades (final transcript, minimum grades for transferred courses).
 * hillel:      Hillel International 2025 college guide: overall rank by Jewish undergrad population, count, public/private.
 *              Top 100 = 60 public + 40 private schools merged by size. Researched 2026-11-24.
 * deadlineDate: ISO date for the fall-2027 entering class when the college states a fixed date.
 */
window.GYF_COLLEGES = {
 "asOf": "2026-11-24",
 "top": 100,
 "colleges": [
  {
   "name": "University of Florida",
   "deferral": "no",
   "how": null,
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": "If you can't enroll for your admitted term, you must apply for readmission to a different term.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.ufl.edu/apply/readmission",
   "quote": "If you are unable to enroll for the term for which you have been admitted, you must apply for readmission again to a different term.",
   "hillel": {
    "rank": 1,
    "jewish": 6500,
    "type": "Public",
    "name": "University of Florida"
   }
  },
  {
   "name": "Rutgers University, New Brunswick",
   "deferral": "yes",
   "how": "Choose your school, pay the $150 enrollment fee online, then contact Rutgers in writing; Undergraduate Admissions must confirm approval.",
   "deadline": "May 1 (enrollment fee; final high school transcript due July 1)",
   "deadlineDate": "2027-05-01",
   "length": "One full academic year, fall to fall.",
   "deposit": true,
   "creditLevel": "none",
   "credit": "No additional high school or college courses during the deferral year; any credit-bearing college enrollment cancels the deferral.",
   "grades": "Requires your final high school transcript; senior grades must not decline, and any final grade below C can cancel the deferral.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.rutgers.edu/deferral",
   "quote": "During the deferral year, you may not take any additional high school or college courses.",
   "hillel": {
    "rank": 2,
    "jewish": 6400,
    "type": "Public",
    "name": "Rutgers University, New Brunswick"
   }
  },
  {
   "name": "University of Maryland, College Park",
   "deferral": "case",
   "how": "Confirm enrollment and pay the $400 deposit in the Terps Application Portal, then email the Deferral Request Form to ApplyMaryland@umd.edu.",
   "deadline": "Your enrollment confirmation deadline (in your admission letter)",
   "deadlineDate": null,
   "length": null,
   "deposit": true,
   "creditLevel": "unclear",
   "credit": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.umd.edu/persona/deferral-requests",
   "quote": "Requests to defer enrollment will be considered on an individual basis.",
   "hillel": {
    "rank": 4,
    "jewish": 5800,
    "type": "Public",
    "name": "University of Maryland, College Park"
   }
  },
  {
   "name": "University of Michigan",
   "deferral": "case",
   "how": "In Enrollment Connect: Application menu → Defer Your Admission.",
   "deadline": "July 15 if you've paid the fall deposit (otherwise your deposit deadline)",
   "deadlineDate": "2027-07-15",
   "length": "Typically one year",
   "deposit": null,
   "creditLevel": "none",
   "credit": "No college coursework at all during the deferral, for credit or not. Enrolling in a credit-eligible program elsewhere cancels the deferral.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://teamdynamix.umich.edu/TDClient/154/Portal/KB/ArticleDet?ID=7467",
   "quote": "College coursework is not allowed during a gap year/deferment.",
   "hillel": {
    "rank": 5,
    "jewish": 5000,
    "type": "Public",
    "name": "University of Michigan"
   }
  },
  {
   "name": "Indiana University",
   "deferral": "case",
   "how": "Contact IU Bloomington Admissions to find out the steps. IU's admitted-student page doesn't list a form.",
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": true,
   "creditLevel": "unclear",
   "credit": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://iu.edu/admissions/after-admitted/",
   "quote": "If you want to defer your admission to another term, you'll need to contact the admissions office at your campus to find out what steps are required.",
   "hillel": {
    "rank": 6,
    "jewish": 4500,
    "type": "Public",
    "name": "Indiana University"
   }
  },
  {
   "name": "CUNY, Brooklyn College",
   "deferral": "no",
   "how": "Pay the commitment deposit and email Undergraduate Admissions to postpone to the next semester.",
   "deadline": null,
   "deadlineDate": null,
   "length": "Next semester only.",
   "deposit": true,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.brooklyn.edu/admissions-aid/international/incoming-students/",
   "quote": "If you are an admitted first-year student and would like to defer, you must pay the commitment deposit and email the Office of Undergraduate Admissions requesting that your admission be postponed for the next semester.",
   "hillel": {
    "rank": 7,
    "jewish": 4000,
    "type": "Public",
    "name": "CUNY, Brooklyn College"
   }
  },
  {
   "name": "University of Wisconsin–Madison",
   "deferral": "yes",
   "how": "Accept your offer by the confirmation deadline and submit the Deferred Enrollment Request Form.",
   "deadline": "Same as your enrollment confirmation deadline",
   "deadlineDate": null,
   "length": "Up to one year",
   "deposit": true,
   "creditLevel": "none",
   "credit": "Deferral is not granted to enroll at another institution or in any program that grants college credit, in the U.S. or abroad.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.wisc.edu/deferred-enrollment/",
   "quote": "Students will not be granted deferred enrollment to enroll at another academic institution or to enroll in a program that grants college credit in the United States or abroad.",
   "hillel": {
    "rank": 9,
    "jewish": 4000,
    "type": "Public",
    "name": "University of Wisconsin, Madison"
   }
  },
  {
   "name": "Pennsylvania State University, University Park",
   "deferral": "case",
   "how": "Email admissions@psu.edu with a deferral request.",
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.psu.edu/resources/faq/admitted-students",
   "quote": "Please email admissions@psu.edu with any request to defer an offer of admission to learn about potential options.",
   "hillel": {
    "rank": 10,
    "jewish": 4000,
    "type": "Public",
    "name": "Pennsylvania State University, University Park"
   }
  },
  {
   "name": "Boston University",
   "deferral": "yes",
   "how": "Email the Request for Deferral of Admission form to admissions@bu.edu along with your enrollment deposit. Requests are reviewed first come, first served.",
   "deadline": "July 1 (fall admits)",
   "deadlineDate": "2027-07-01",
   "length": "One semester or one year (some schools set their own limits)",
   "deposit": true,
   "creditLevel": "limited",
   "credit": "You may take non-degree courses during the deferral, up to two per semester. Transfer credit is decided under BU's usual rules.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://www.bu.edu/admissions/files/2019/02/deferral_form.pdf",
   "quote": "JULY 1: Deadline for submission of your Request for Deferral of Admission form … if you were admitted for the fall semester.",
   "note": "This comes from BU's 2019 deferral form, so confirm the current version with BU Admissions.",
   "hillel": {
    "rank": 11,
    "jewish": 4000,
    "type": "Private",
    "name": "Boston University"
   }
  },
  {
   "name": "Binghamton University",
   "deferral": "case",
   "how": "Pay the enrollment deposit, then complete the Deferred Enrollment Request Form in your applicant checklist (or email admit@binghamton.edu).",
   "deadline": "July 1 (fall admits)",
   "deadlineDate": "2027-07-01",
   "length": "One year",
   "deposit": true,
   "creditLevel": "none",
   "credit": "Studying at another college — even non-credit coursework — isn't an accepted reason to defer. Approved gap year programs are the exception.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://www.binghamton.edu/admissions/undergraduate/info/deferral-process.html",
   "quote": "Students who are found to have applied to, or enrolled at, other colleges or universities during their deferment (excluding approved gap year programs) will have their admission revoked.",
   "hillel": {
    "rank": 12,
    "jewish": 3700,
    "type": "Public",
    "name": "Binghamton University"
   }
  },
  {
   "name": "McGill University",
   "deferral": "yes",
   "how": "Accept the offer and pay the confirmation deposit; then use the McGill Applicant Portal's Additional options to select 'Defer your application'.",
   "deadline": "September-term admits: August 31; January-term admits: December 31.",
   "deadlineDate": null,
   "length": "Up to one academic year (the page also describes one-term deferrals).",
   "deposit": true,
   "creditLevel": "none",
   "credit": "Participation in post-secondary study at another college or university, or furthering academic coursework, is prohibited; McGill may revoke a deferral for enrolling in unapproved undergraduate-level courses during the gap year.",
   "grades": "Deferral may be refused or revoked for academic cause, including a dramatic decline in grades during the final portion of the pre-university program.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.mcgill.ca/accepted/nextsteps/deferring-your-offer",
   "quote": "Participation in post-secondary study at another college or university, or furthering academic course-work, is prohibited.",
   "hillel": {
    "rank": 13,
    "jewish": 3500,
    "type": "Public",
    "name": "McGill University"
   }
  },
  {
   "name": "Florida State University",
   "deferral": "case",
   "how": "Submit the short bridge-year application; a university committee reviews your plans.",
   "deadline": null,
   "deadlineDate": null,
   "length": "One year (fall to fall, or summer to summer; spring isn't eligible).",
   "deposit": null,
   "creditLevel": "none",
   "credit": "You must not earn college credit during the bridge year.",
   "grades": "Admission can be rescinded if your academic and personal record doesn't stay satisfactory.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://regulations.fsu.edu/sites/g/files/upcbnu486/files/policies/provost/FSU%20Policy%209-5_20191031.pdf",
   "quote": "Florida State University Office of Admissions grants a small number of one-year deferments of matriculation to admitted high school students who wish to take a bridge year (also known as a gap year) between graduation from high school and matriculation at FSU.",
   "hillel": {
    "rank": 14,
    "jewish": 3500,
    "type": "Public",
    "name": "Florida State University"
   }
  },
  {
   "name": "University of Arizona",
   "deferral": "yes",
   "how": "Log in to Future Wildcat, open the application, select \"Defer Admission,\" and submit the form. Requires the enrollment fee.",
   "deadline": null,
   "deadlineDate": null,
   "length": "Up to two semesters; up to four for military or faith-based mission.",
   "deposit": true,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.arizona.edu/admissions/defer",
   "quote": "Deferred admission is permitted for all main campus students for up to two semesters (or four semesters for students deferring for military or a faith-based mission).",
   "hillel": {
    "rank": 16,
    "jewish": 3500,
    "type": "Public",
    "name": "University of Arizona"
   }
  },
  {
   "name": "York University",
   "deferral": "case",
   "how": "Accept the offer through MyFile or OUAC, submit all documents required to meet admission conditions (including final official transcripts and grades), and apply for deferral; requests are reviewed case by case.",
   "deadline": "Fall term: September 11 (stated for Fall 2026)",
   "deadlineDate": null,
   "length": "Up to a maximum of one year.",
   "deposit": null,
   "creditLevel": "none",
   "credit": "Not eligible to defer if the purpose is to attend an accredited post-secondary institution.",
   "grades": "Must submit all documents needed to meet admission conditions, including final official transcripts and grades; the page does not state a policy for grades earned during the deferral.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://secure.students.yorku.ca/deferral-of-admission-for-undergraduate-students",
   "quote": "You are not eligible to apply for a deferral if: You want to defer your admission to attend an accredited post-secondary institution... Deferrals are not guaranteed and will be reviewed on a case-by-case basis.",
   "hillel": {
    "rank": 17,
    "jewish": 3500,
    "type": "Public",
    "name": "York University"
   }
  },
  {
   "name": "Arizona State University",
   "deferral": "case",
   "how": "Withdraw from any classes, then submit the online deferral application (or email deferugadmissions@asu.edu with your ASU ID, reason and intended term).",
   "deadline": "At least two weeks before the first day of classes.",
   "deadlineDate": null,
   "length": "One year for most; up to five terms for some religious or military service.",
   "deposit": null,
   "creditLevel": "none",
   "credit": "You may not attend another college or university during the deferment.",
   "grades": null,
   "israel": "Longer deferrals are possible for religious or military service.",
   "noApplyingElsewhere": true,
   "source": "https://admission.asu.edu/apply/first-year/admitted/cancel-defer",
   "quote": null,
   "hillel": {
    "rank": 18,
    "jewish": 3500,
    "type": "Public",
    "name": "Arizona State University"
   }
  },
  {
   "name": "University of Colorado at Boulder",
   "deferral": "yes",
   "how": "Use the term-change form on your application status page (new term, reasons and planned activities).",
   "deadline": "5:00 PM MT on the first day of classes for your admitted term.",
   "deadlineDate": null,
   "length": "Up to one year from your original term.",
   "deposit": null,
   "creditLevel": "none",
   "credit": "Taking college courses elsewhere turns you into a transfer applicant once official transcripts arrive.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.colorado.edu/admissions/process/term-change-faqs",
   "quote": null,
   "hillel": {
    "rank": 22,
    "jewish": 3000,
    "type": "Public",
    "name": "University of Colorado at Boulder"
   }
  },
  {
   "name": "Western University",
   "deferral": "case",
   "how": "Accept your offer, submit the Request for Deferral of Studies form, and reapply through OUAC.",
   "deadline": "August 1 (deferral form; reapply through OUAC by January 15)",
   "deadlineDate": "2027-08-01",
   "length": "One year.",
   "deposit": true,
   "creditLevel": "none",
   "credit": "You can't attend another post-secondary institution during the year off; doing so cancels the request and forfeits deposits.",
   "grades": "Scholarship eligibility still uses your final high school average.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://welcome.uwo.ca/next-steps/accept-offer/request-to-defer-your-studies.html",
   "quote": "We will review requests on a case-by-case basis.",
   "hillel": {
    "rank": 23,
    "jewish": 3000,
    "type": "Public",
    "name": "Western University"
   }
  },
  {
   "name": "George Washington University",
   "deferral": "yes",
   "how": "After paying the deposit, use \"Manage Application Details\" in the admissions portal to complete the deferral form.",
   "deadline": "Considered until the first day of classes (preferred deadlines are listed on GW's page)",
   "deadlineDate": null,
   "length": "One or two semesters (longer for national military service)",
   "deposit": true,
   "creditLevel": "none",
   "credit": "You can't enroll at another institution, and credit earned elsewhere during the deferral won't transfer.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://undergraduate.admissions.gwu.edu/apply/deferral",
   "quote": "Credit earned at other institutions during the deferral period is not eligible for transfer credit.",
   "hillel": {
    "rank": 24,
    "jewish": 3000,
    "type": "Private",
    "name": "George Washington University"
   }
  },
  {
   "name": "Tulane University",
   "deferral": "case",
   "how": "Email Tulane Admission to request the \"Request to Defer Enrollment to a Future Term\" form. Requests open January 1.",
   "deadline": "May 15",
   "deadlineDate": "2027-05-15",
   "length": "One year (longer only by written request)",
   "deposit": true,
   "creditLevel": "none",
   "credit": "You can't attend another university or join a college-credit program during the gap year. Summer courses may count for transfer credit under certain conditions.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://admission.tulane.edu/apply/gap-year",
   "quote": "Admitted students who are approved for a gap year cannot re-apply to other colleges/universities while holding a space at Tulane.",
   "hillel": {
    "rank": 25,
    "jewish": 2866,
    "type": "Private",
    "name": "Tulane University"
   }
  },
  {
   "name": "Ohio State University",
   "deferral": "yes",
   "how": "Pay the acceptance fee, contact Undergraduate Admissions for a Gap Year Request Form, provide a personal statement/documentation, and submit it.",
   "deadline": "August 1 (before the original term of admission; acceptance fee by May 1 for Columbus)",
   "deadlineDate": "2027-08-01",
   "length": "One year, autumn semester to following autumn semester.",
   "deposit": true,
   "creditLevel": "none",
   "credit": "Students cannot enroll in another college/university or participate in a program that earns college credit during the gap year.",
   "grades": "After graduation, have the high school send the final transcript showing the graduation date.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://undergrad.osu.edu/apply/gap-year-policy",
   "quote": "Students cannot take a gap year to enroll in another college or university or to participate in a program that earns college credit.",
   "hillel": {
    "rank": 26,
    "jewish": 2777,
    "type": "Public",
    "name": "Ohio State University"
   }
  },
  {
   "name": "University of Texas, Austin",
   "deferral": "case",
   "how": "Submit an online appeal with a brief statement of 500 words or fewer describing the circumstances; supplemental materials are optional.",
   "deadline": "Fall freshman appeals: January 1–March 15",
   "deadlineDate": null,
   "length": "A single semester or up to one year.",
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.utexas.edu/apply/review-decision-process/appeals/",
   "quote": "Admitted students should select this option if they would like to defer their admission to a later semester. Students may request a single semester or up to a year change. Each appeal is considered on a case-by-case basis.",
   "hillel": {
    "rank": 27,
    "jewish": 2750,
    "type": "Public",
    "name": "University of Texas, Austin"
   }
  },
  {
   "name": "Michigan State University",
   "deferral": "yes",
   "how": "Accept your offer and pay the fee, then request a delay in your student account and send your final transcript.",
   "deadline": "September 1 (accept and pay by May 1; final transcript by June 30).",
   "deadlineDate": "2027-09-01",
   "length": "Two semesters (summer not included).",
   "deposit": true,
   "creditLevel": "none",
   "credit": "No college coursework allowed; taking any cancels the delay and you must reapply as a transfer.",
   "grades": "Final high school transcript due June 30.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://admissions.msu.edu/admitted/delay-admission-change-term",
   "quote": null,
   "hillel": {
    "rank": 28,
    "jewish": 2700,
    "type": "Public",
    "name": "Michigan State University"
   }
  },
  {
   "name": "UMass Amherst",
   "deferral": "case",
   "how": "Log in and complete the deferral request form. UMass may ask for more documentation.",
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": true,
   "creditLevel": "limited",
   "credit": "You can take up to 11 credits total elsewhere as a non-degree student. More than that, or enrolling elsewhere, cancels the deferral.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.umass.edu/admissions/deferral-policy",
   "quote": "The University of Massachusetts Amherst rarely approves requests to defer admission decisions",
   "hillel": {
    "rank": 30,
    "jewish": 2500,
    "type": "Public",
    "name": "University of Massachusetts, Amherst"
   }
  },
  {
   "name": "University of California, Los Angeles",
   "deferral": "case",
   "how": "Submit a deferral request through the admitted-student process. UCLA grants few deferrals.",
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admission.ucla.edu/admitted-students/first-year-accept-your-offer",
   "quote": "UCLA does not grant many deferrals. Students are only admitted to the term for which they applied.",
   "hillel": {
    "rank": 31,
    "jewish": 2500,
    "type": "Public",
    "name": "University of California, Los Angeles"
   }
  },
  {
   "name": "Virginia Tech",
   "deferral": "case",
   "how": "After accepting admission and paying the deposit, email the deferral request to appchange@vt.edu; a form will be provided.",
   "deadline": "June 15 (summer/fall applicants)",
   "deadlineDate": "2027-06-15",
   "length": "Up to two semesters (fall/spring).",
   "deposit": true,
   "creditLevel": "none",
   "credit": "Deferred students may not attend any other two-year or four-year institution during the deferment period.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.vt.edu/admissions/undergraduate/apply/policies.html#defer",
   "quote": "Deferred students may not attend any other two-year or four-year institution during the deferment period.",
   "hillel": {
    "rank": 32,
    "jewish": 2500,
    "type": "Public",
    "name": "Virginia Tech"
   }
  },
  {
   "name": "University of California, Berkeley",
   "deferral": "case",
   "how": "Submit the Request for Deferment form (open May 1 to June 1); Berkeley approves deferrals only for compelling reasons.",
   "deadline": "June 1 (form opens May 1; response by July 31)",
   "deadlineDate": "2027-06-01",
   "length": "To the next fall.",
   "deposit": true,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admit.berkeley.edu/faqs/",
   "quote": "The Office of Undergraduate Admission reviews requests to defer for compelling reasons.",
   "hillel": {
    "rank": 34,
    "jewish": 2500,
    "type": "Public",
    "name": "University of California, Berkeley"
   }
  },
  {
   "name": "Cornell University",
   "deferral": "yes",
   "how": "Submit the form in the applicant portal and discuss the gap-year plan with Undergraduate Admissions.",
   "deadline": "June 1 (Regular Decision admits; March 1 for Early Decision)",
   "deadlineDate": "2027-06-01",
   "length": "One or two years.",
   "deposit": true,
   "creditLevel": "none",
   "credit": "Requests to study elsewhere are rarely approved, whether or not the program includes college credit.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.cornell.edu/policies/enrollment-deferral-requests",
   "quote": "Cornell University supports requests to defer enrollment for one or two years.",
   "hillel": {
    "rank": 35,
    "jewish": 2500,
    "type": "Private",
    "name": "Cornell University"
   }
  },
  {
   "name": "Syracuse University",
   "deferral": "yes",
   "how": "In the Applicant Portal, submit the acceptance form, your deposits, and the Request for Deferral of Admission.",
   "deadline": "June 15 (fall admits)",
   "deadlineDate": "2027-06-15",
   "length": "One or two semesters (two years for mandatory military service)",
   "deposit": true,
   "creditLevel": "limited",
   "credit": "Non-degree courses during the deferral are limited to two per semester. You must reapply for need-based aid; merit scholarships carry over.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://www.syracuse.edu/admissions-aid/application-process/undergraduate/admitted/checklist/deferral-request/",
   "quote": "Deferred admission may only be granted to admitted students who have paid the non-refundable $500 tuition deposit and $450 housing deposit (if living on campus).",
   "hillel": {
    "rank": 36,
    "jewish": 2500,
    "type": "Private",
    "name": "Syracuse University"
   }
  },
  {
   "name": "New York University",
   "deferral": "yes",
   "how": "Complete the Deferred Enrollment Request Form in the NYU Admitted Student Portal.",
   "deadline": "Campus-specific deadline in your admitted-student portal",
   "deadlineDate": null,
   "length": "One year (an additional year may be approved)",
   "deposit": true,
   "creditLevel": "limited",
   "credit": "You may not defer in order to attend another college or university.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://www.nyu.edu/admissions/undergraduate-admissions/admitted-students/deferring-your-enrollment.html",
   "quote": "You may not defer your enrollment to apply to other colleges and universities during your time away from NYU. If you do, your NYU admission will be revoked.",
   "hillel": {
    "rank": 37,
    "jewish": 2500,
    "type": "Private",
    "name": "New York University"
   }
  },
  {
   "name": "University of Connecticut",
   "deferral": "yes",
   "how": "Submit the Gap Year/Deferment Request Form in the applicant portal and share your plan; pay the enrollment fee to secure your seat.",
   "deadline": "May 1 (with the enrollment fee)",
   "deadlineDate": "2027-05-01",
   "length": "Up to one year.",
   "deposit": true,
   "creditLevel": "none",
   "credit": "Students may not enroll at another institution during the gap year/deferment period.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.uconn.edu/fall-checklist/",
   "quote": "There are reasons first-year students may need to delay the start of their UConn education up to a year from the admission term.",
   "hillel": {
    "rank": 41,
    "jewish": 2000,
    "type": "Public",
    "name": "University of Connecticut"
   }
  },
  {
   "name": "University of Oregon",
   "deferral": "case",
   "how": "Submit Intent to Register and enrollment deposit by May 1; by June 30 submit a written gap-year statement and the Gap Year Deferral Agreement and Proposal through the online form.",
   "deadline": "June 30 (deferral agreement and proposal; deposit by May 1)",
   "deadlineDate": "2027-06-30",
   "length": "Up to one year; longer than one calendar year requires a new application.",
   "deposit": true,
   "creditLevel": "unclear",
   "credit": "The page says a gap-year activity may allow academic credit, but does not state how credits earned during deferral are treated for admission or transfer.",
   "grades": "UO will outline academic conditions, typically maintaining the admitted GPA if it does not already have the final high-school transcript; significant later grade drops may make a student ineligible.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://www.uoregon.edu/admissions/operations/defer-or-gap-year/",
   "quote": "Requesting and accepting a deferral is a commitment to enroll at UO in a future term. Students who plan to apply to other colleges or universities during the gap year should not request a deferral.",
   "hillel": {
    "rank": 42,
    "jewish": 2000,
    "type": "Public",
    "name": "University of Oregon"
   }
  },
  {
   "name": "University of Miami",
   "deferral": "case",
   "how": "Submit a request to postpone enrollment; the Admission Committee reviews it.",
   "deadline": null,
   "deadlineDate": null,
   "length": "Up to one academic year.",
   "deposit": true,
   "creditLevel": "unclear",
   "credit": "Restrictions are set in your postponement and admission letters.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://bulletin.miami.edu/general-university-information/undergraduate-policies-and-procedures/admission/postponement-deferment/",
   "quote": "Requests are reviewed case-by-case by the Admission Committee.",
   "hillel": {
    "rank": 43,
    "jewish": 2000,
    "type": "Private",
    "name": "University of Miami"
   }
  },
  {
   "name": "University of Southern California",
   "deferral": "yes",
   "how": "Request a deferral through the admission process.",
   "deadline": null,
   "deadlineDate": null,
   "length": "Up to one year; longer gaps for religious reasons or compulsory military service are considered.",
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": "Longer deferrals are considered for religious reasons.",
   "noApplyingElsewhere": null,
   "source": "https://catalogue.usc.edu/content.php?catoid=8&navoid=2391",
   "quote": "students may defer admission for up to one year",
   "hillel": {
    "rank": 44,
    "jewish": 2000,
    "type": "Private",
    "name": "University of Southern California"
   }
  },
  {
   "name": "Florida Atlantic University",
   "deferral": "case",
   "how": "Ask FAU Admissions about its deferred enrollment policy for approved gap-year programs.",
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": "In 2026 FAU announced a new pathway for Israel gap-year students, with a deferred enrollment policy for students in approved gap-year programs.",
   "noApplyingElsewhere": null,
   "source": "https://www.fau.edu/news/2026/gapyearrelease/index.php",
   "quote": "its deferred enrollment policy provides greater certainty for students who elect to participate in approved gap-year programs after high school",
   "hillel": {
    "rank": 45,
    "jewish": 1750,
    "type": "Public",
    "name": "Florida Atlantic University"
   }
  },
  {
   "name": "Washington University in St. Louis",
   "deferral": "case",
   "how": "Email the Admissions Office to request a gap year.",
   "deadline": "May 15",
   "deadlineDate": "2027-05-15",
   "length": "One year",
   "deposit": true,
   "creditLevel": "limited",
   "credit": "You can't enroll full time elsewhere. Any coursework must be reviewed by your dean's office, which decides whether it transfers.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.washu.edu/how-to-apply/common-questions/",
   "quote": "Students are unable to enroll full-time in another institution during this time.",
   "hillel": {
    "rank": 46,
    "jewish": 1750,
    "type": "Private",
    "name": "Washington University in St. Louis"
   }
  },
  {
   "name": "Brown University",
   "deferral": "case",
   "how": "After accepting Brown's offer, email admission@brown.edu with your request. The Board of Admission reviews it.",
   "deadline": "May 15",
   "deadlineDate": "2027-05-15",
   "length": "One year",
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admission.brown.edu/ask/deferring-enrollment",
   "quote": "Those requests are reviewed on a case-by-case basis by the Board of Admission.",
   "hillel": {
    "rank": 48,
    "jewish": 1700,
    "type": "Private",
    "name": "Brown University"
   }
  },
  {
   "name": "CUNY, Baruch College",
   "deferral": "case",
   "how": "Accept your offer and pay the commitment deposit, then submit the deferral request in the admitted-student portal.",
   "deadline": "June 1 (accept and pay by May 1; confirm your return by March 1)",
   "deadlineDate": "2027-06-01",
   "length": "Maximum one year (two semesters), no extension.",
   "deposit": true,
   "creditLevel": "none",
   "credit": "No college credit-bearing courses; taking any cancels your freshman admission and you must apply as a transfer.",
   "grades": "Requires high school graduation and a final transcript.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://enrollmentmanagement.baruch.cuny.edu/undergraduate-admissions/admitted-freshmen-students/deferrals/",
   "quote": "Requests for a deferral are subject to approval by the Director of Admissions.",
   "hillel": {
    "rank": 50,
    "jewish": 1500,
    "type": "Public",
    "name": "CUNY, Baruch College"
   }
  },
  {
   "name": "Temple University, Main and Ambler",
   "deferral": "case",
   "how": "Complete the deferral form in the Applicant Portal and send your final high school transcript.",
   "deadline": null,
   "deadlineDate": null,
   "length": "Up to one year.",
   "deposit": true,
   "creditLevel": "none",
   "credit": "Deferrals aren't approved to attend another college or university.",
   "grades": "Final high school transcript required.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://admissions.temple.edu/apply/admitted-students",
   "quote": "Students will not be approved to defer to attend another college or university or to apply to another college or university while holding their space at Temple.",
   "hillel": {
    "rank": 53,
    "jewish": 1500,
    "type": "Public",
    "name": "Temple University, Main and Ambler"
   }
  },
  {
   "name": "University of Washington",
   "deferral": "no",
   "how": "No deferrals; submit a new application for a future quarter.",
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.washington.edu/newhuskies/must-do/accept/",
   "quote": "The offer is valid only for the quarter stated in the offer letter.",
   "hillel": {
    "rank": 57,
    "jewish": 1500,
    "type": "Public",
    "name": "University of Washington"
   }
  },
  {
   "name": "Toronto Metropolitan University Toronto",
   "deferral": "case",
   "how": "Contact Admissions to request a deferral.",
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.torontomu.ca/admissions/undergraduate/after-applying/admitted-students/",
   "quote": "We don't guarantee deferrals, but we do our best to grant them whenever possible.",
   "hillel": {
    "rank": 58,
    "jewish": 1500,
    "type": "Public",
    "name": "Toronto Metropolitan University Toronto"
   }
  },
  {
   "name": "University of Toronto, St. George",
   "deferral": "yes",
   "how": "Submit the deferral form linked from the U of T admission decisions page.",
   "deadline": null,
   "deadlineDate": null,
   "length": "One year",
   "deposit": null,
   "creditLevel": "none",
   "credit": "Applicants planning to attend another post-secondary institution may not defer.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://www.artsci.utoronto.ca/future/ready-apply/faqs",
   "quote": "Applicants who plan to attend another post-secondary institution will not be permitted to defer their admission.",
   "hillel": {
    "rank": 59,
    "jewish": 1500,
    "type": "Public",
    "name": "University of Toronto, St. George"
   }
  },
  {
   "name": "American University",
   "deferral": "case",
   "how": "Contact the deferral liaison in Undergraduate Admissions, who provides instructions for the formal request; submit the deferral request form.",
   "deadline": "July 1",
   "deadlineDate": "2027-07-01",
   "length": null,
   "deposit": true,
   "creditLevel": "limited",
   "credit": "Deferral does not permit degree-seeking study at another institution. Up to six semester credit hours may be taken as a non-degree student without prior approval; coursework over six hours must be disclosed in the request and receive advance approval. Any college credits taken result in transfer-student status upon matriculation.",
   "grades": "Students must maintain a 3.0 GPA and send an official transcript for coursework taken during deferral.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://www.american.edu/admissions/first-year/deferral-policy.cfm",
   "quote": "You must maintain a 3.0 GPA and have an official transcript sent to us for any course work taken during the deferral period.",
   "hillel": {
    "rank": 60,
    "jewish": 1500,
    "type": "Private",
    "name": "American University"
   }
  },
  {
   "name": "University of Pittsburgh",
   "deferral": "yes",
   "how": "Pay the enrollment fee, then request a deferral.",
   "deadline": "May 1 (enrollment fee).",
   "deadlineDate": "2027-05-01",
   "length": "Up to one academic year.",
   "deposit": true,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.pitt.edu/first-year-student/deferring-admission/",
   "quote": null,
   "hillel": {
    "rank": 61,
    "jewish": 1400,
    "type": "Public",
    "name": "University of Pittsburgh"
   }
  },
  {
   "name": "University of Minnesota",
   "deferral": "yes",
   "how": "Submit a gap year or gap semester request through the University's request process.",
   "deadline": "July 1 (priority deadline)",
   "deadlineDate": "2027-07-01",
   "length": "A gap year moves fall admission to the next fall; a gap semester moves it to spring.",
   "deposit": null,
   "creditLevel": "none",
   "credit": "You may not enroll at another institution or in a credit-granting program; doing so loses freshman status and you must reapply as a transfer.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.tc.umn.edu/admissions/forms-publications-resources/gap-year-and-gap-semester-requests",
   "quote": "Students admitted... as incoming freshmen may request to take a gap year or semester",
   "hillel": {
    "rank": 62,
    "jewish": 1400,
    "type": "Public",
    "name": "University of Minnesota"
   }
  },
  {
   "name": "Columbia University",
   "deferral": "yes",
   "how": "After submitting the response form, request a deferral through the application status portal.",
   "deadline": null,
   "deadlineDate": null,
   "length": "One year; a second year may be granted on request",
   "deposit": null,
   "creditLevel": "limited",
   "credit": "You can't defer in order to enroll full-time at another college or university.",
   "grades": "Columbia can withdraw an offer for a significant drop in academic performance or failure to graduate high school.",
   "israel": "Students doing mandatory national service receive a deferral if admitted.",
   "noApplyingElsewhere": null,
   "source": "https://undergrad.admissions.columbia.edu/faqview?page=1",
   "quote": "A candidate who has been offered first-year admission may ask to defer enrollment for a year to work, travel, complete mandatory military service or pursue a special opportunity.",
   "hillel": {
    "rank": 63,
    "jewish": 1400,
    "type": "Private",
    "name": "Columbia University"
   }
  },
  {
   "name": "Northeastern University",
   "deferral": "case",
   "how": "Submit the request through the request link in Application Status Check.",
   "deadline": "July 1 (Boston or Oakland; June 1 for N.U.in, London or NYC Scholars)",
   "deadlineDate": "2027-07-01",
   "length": "Maximum one year; one request.",
   "deposit": true,
   "creditLevel": "none",
   "credit": "Students may not take any classes for academic credit during the deferral period.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.northeastern.edu/application-information/frequently-asked-admissions-questions/",
   "quote": "Students may not take any classes for academic credit during the deferral period.",
   "hillel": {
    "rank": 64,
    "jewish": 1350,
    "type": "Private",
    "name": "Northeastern University"
   }
  },
  {
   "name": "Brandeis University",
   "deferral": "yes",
   "how": "Submit a deferral request as an admitted first-year student.",
   "deadline": "May 15",
   "deadlineDate": "2027-05-15",
   "length": "One year.",
   "deposit": null,
   "creditLevel": "limited",
   "credit": "Up to four outside courses (16 credits) can count; gap-year college courses can transfer if you earn a B- or better and they weren't used for your high school diploma.",
   "grades": "Gap-year courses transfer as credit with a B- or better; they aren't stated to count in your Brandeis GPA.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.brandeis.edu/admissions/admitted/defer.html",
   "quote": "Students admitted to Brandeis as first-years may defer enrollment for one year",
   "hillel": {
    "rank": 66,
    "jewish": 1300,
    "type": "Private",
    "name": "Brandeis University"
   }
  },
  {
   "name": "University of Alabama",
   "deferral": "case",
   "how": "Complete the Scholarship Gap Request Form on the Admissions & Scholarships page of myBama after the final scholarship notification round.",
   "deadline": null,
   "deadlineDate": null,
   "length": "Up to three years for listed scholarships, if eligible for re-admission",
   "deposit": null,
   "creditLevel": "none",
   "credit": "New first-time freshmen may not enroll at another college/university or earn college credit during the gap.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://afford.ua.edu/scholarships/policies/",
   "quote": "New first-time freshman students are not permitted to enroll at any other college/university or earn college credit during their gap.",
   "hillel": {
    "rank": 67,
    "jewish": 1250,
    "type": "Public",
    "name": "University of Alabama"
   }
  },
  {
   "name": "Purdue University",
   "deferral": "case",
   "how": "Accept the offer (including the required deposit), then complete the enrollment deferral year request form in the Purdue application portal; send official transcripts for completed college coursework.",
   "deadline": "Four weeks before the first day of classes for the original enrollment term.",
   "deadlineDate": null,
   "length": "Up to six semesters for a first-year applicant.",
   "deposit": true,
   "creditLevel": "limited",
   "credit": "Applicants cannot have 12 or more post-high-school college credits to be eligible. A first-year applicant who enrolls full-time elsewhere after high-school graduation must reapply as a transfer student.",
   "grades": "If information changes, including coursework elsewhere, Purdue may reevaluate admission; applicants submitting transcripts with a C- or below may be reevaluated.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.purdue.edu/admitted-students/gap-year-policy/",
   "quote": "Students cannot have 12 or more college credits post-high school graduation to be eligible.",
   "hillel": {
    "rank": 68,
    "jewish": 1250,
    "type": "Public",
    "name": "Purdue University"
   }
  },
  {
   "name": "Emory University",
   "deferral": "case",
   "how": "Submit the deferral request form on the Admitted Student Website.",
   "deadline": "Your admission plan's deposit deadline",
   "deadlineDate": null,
   "length": "Usually one year (two for military or religious commitments)",
   "deposit": true,
   "creditLevel": "limited",
   "credit": "You can't be degree-seeking elsewhere, but up to two single-semester courses (about 6 Emory credit hours) may transfer after review.",
   "israel": "Two-year deferrals are possible for religious commitments.",
   "noApplyingElsewhere": true,
   "source": "https://apply.emory.edu/apply/faqs",
   "quote": "Should a deferred student change their mind about enrollment while on a gap year, they agree to withdraw from Emory University before they apply to any other schools or institutions.",
   "hillel": {
    "rank": 69,
    "jewish": 1250,
    "type": "Private",
    "name": "Emory University"
   }
  },
  {
   "name": "Stony Brook University",
   "deferral": "case",
   "how": "Submit the Deferral Request Form in the StartSBU portal.",
   "deadline": null,
   "deadlineDate": null,
   "length": "Up to one year.",
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.stonybrook.edu/visa/arrival/pre-arrival/adjusting-your-arrival-plans.html",
   "quote": null,
   "hillel": {
    "rank": 70,
    "jewish": 1200,
    "type": "Public",
    "name": "Stony Brook University"
   }
  },
  {
   "name": "University of Guelph",
   "deferral": "yes",
   "how": "Accept through OUAC, meet your offer conditions, then submit the deferral application in WebAdvisor ($100 fee).",
   "deadline": "July 31",
   "deadlineDate": "2027-07-31",
   "length": "One year",
   "deposit": true,
   "creditLevel": "none",
   "credit": "You can't take courses at Guelph or any other college/university during the deferral; extra high-school courses are allowed.",
   "grades": "Offer conditions (final grades) must be met by July 16.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.uoguelph.ca/admission/undergraduate/apply/defer",
   "quote": "Submit the deferral application and pay the non-refundable $100 fee by July 31, 2027.",
   "hillel": {
    "rank": 72,
    "jewish": 1200,
    "type": "Public",
    "name": "University of Guelph"
   }
  },
  {
   "name": "Long Island University, Brooklyn Campus",
   "deferral": "yes",
   "how": "Contact an admissions recruiter to complete the deferral.",
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": "Your scholarship offer is adjusted to the semester you enroll.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://liu.edu/admissions",
   "quote": null,
   "hillel": {
    "rank": 74,
    "jewish": 1200,
    "type": "Private",
    "name": "Long Island University, Brooklyn Campus"
   }
  },
  {
   "name": "Northwestern University",
   "deferral": "yes",
   "how": "Follow Northwestern's deferred-enrollment steps for new students.",
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": null,
   "creditLevel": "none",
   "credit": "Work from another institution completed during a deferral will not transfer to Northwestern.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.northwestern.edu/purple-prep/deferred-and-gap-year-students.html",
   "quote": "any work from another institution completed during a deferral period will not transfer to Northwestern.",
   "hillel": {
    "rank": 75,
    "jewish": 1200,
    "type": "Private",
    "name": "Northwestern University"
   }
  },
  {
   "name": "Tufts University",
   "deferral": "case",
   "how": "Pay the enrollment deposit, then submit the Gap Year Request form (with a substantive plan) on your Applicant Status Page.",
   "deadline": "June 1 (decisions by June 15)",
   "deadlineDate": "2027-06-01",
   "length": "One year (two for compulsory military service)",
   "deposit": true,
   "creditLevel": "none",
   "credit": "Structured or credit-bearing academic programs are not approved, and you can't enroll as a degree candidate elsewhere.",
   "israel": "Deferrals for Kivunim or Young Judaea are typically approved — but Tufts won't accept their academic work for credit.",
   "noApplyingElsewhere": true,
   "source": "https://admissions.tufts.edu/admitted-students/enrollment/2/",
   "quote": "By requesting and accepting a deferral, you are making a commitment to enroll at Tufts in the following academic year.",
   "hillel": {
    "rank": 76,
    "jewish": 1176,
    "type": "Private",
    "name": "Tufts University"
   }
  },
  {
   "name": "University of British Columbia",
   "deferral": "yes",
   "how": "Accept your offer and meet its conditions, then email the deferred admission request form to admissions.inquiry@ubc.ca.",
   "deadline": "July 1 (UBC Vancouver; August 15 for Okanagan)",
   "deadlineDate": "2027-07-01",
   "length": null,
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://you.ubc.ca/applying-ubc/admitted/deferring-admission/",
   "quote": "You are eligible to apply for a deferral if you have been admitted to year one of an undergraduate degree and want to defer admission for reasons such as: You are planning to take a gap year.",
   "hillel": {
    "rank": 77,
    "jewish": 1100,
    "type": "Public",
    "name": "University of British Columbia"
   }
  },
  {
   "name": "Vanderbilt University",
   "deferral": "case",
   "how": "Pay the $400 deposit, then email deferrals@vanderbilt.edu with your full name; they'll send a request form.",
   "deadline": "July 1",
   "deadlineDate": "2027-07-01",
   "length": "One or two years (fall start only)",
   "deposit": true,
   "creditLevel": "limited",
   "credit": "Requests to enroll in a full-time, degree-seeking program at another college won't be approved.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://admissions.vanderbilt.edu/faq/",
   "quote": "Deferral requests from students planning to enroll in degree-seeking, full-time programs at another college will not be approved.",
   "hillel": {
    "rank": 78,
    "jewish": 1100,
    "type": "Private",
    "name": "Vanderbilt University"
   }
  },
  {
   "name": "University of Pennsylvania",
   "deferral": "yes",
   "how": "Accept Penn's offer of admission, then submit a Gap Year Form through the Penn Applicant Portal.",
   "deadline": null,
   "deadlineDate": null,
   "length": "One year",
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admissions.upenn.edu/how-to-apply/resources-programs/glossary",
   "quote": "Students interested in taking a gap year … must first accept Penn's offer of admission, then submit a Gap Year Form through their Penn Applicant Portal.",
   "hillel": {
    "rank": 79,
    "jewish": 1100,
    "type": "Private",
    "name": "University of Pennsylvania"
   }
  },
  {
   "name": "Ithaca College",
   "deferral": "case",
   "how": "Submit the Request a Gap Year form in IC Connect, including reasons and tentative plans.",
   "deadline": "May 15",
   "deadlineDate": "2027-05-15",
   "length": "A semester or year",
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": "Students must still submit a final high school transcript at the end of the academic year in which they were first offered admission.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.ithaca.edu/admission/undergraduate-admission/admitted-students/gap-semester-or-year",
   "quote": "Ithaca College reviews requests to postpone enrollment for a semester or year on a case-by-case basis.",
   "hillel": {
    "rank": 80,
    "jewish": 1050,
    "type": "Private",
    "name": "Ithaca College"
   }
  },
  {
   "name": "Lehigh University",
   "deferral": "case",
   "how": "Request a deferral through Lehigh Admissions; any outside courses must be approved in advance by the Director of Admissions.",
   "deadline": null,
   "deadlineDate": null,
   "length": "Usually one semester or one year.",
   "deposit": null,
   "creditLevel": "limited",
   "credit": "You may take 1–2 courses at another institution during an approved deferral, each approved in advance; faculty decide whether they count toward your degree.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www2.lehigh.edu/admissions/deferrals-gap-year",
   "quote": "Students are permitted to enroll in 1-2 courses at another institution during their approved deferral period",
   "hillel": {
    "rank": 82,
    "jewish": 950,
    "type": "Private",
    "name": "Lehigh University"
   }
  },
  {
   "name": "Drexel University",
   "deferral": "yes",
   "how": "Confirm enrollment by May 1 in Discover Drexel (with the $300 deposit), then submit the deferral request through the linked portal.",
   "deadline": "September 1",
   "deadlineDate": "2027-09-01",
   "length": "One full year, or half a year to the next spring.",
   "deposit": true,
   "creditLevel": "limited",
   "credit": "You may take up to two college classes per term; they're non-matriculated, and whether they count is up to your academic advisor.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://drexel.edu/admissions/undergrad/admitted-students/deferred-enrollment",
   "quote": "You may request to defer your enrollment for one full year ... or half a year ...",
   "hillel": {
    "rank": 83,
    "jewish": 900,
    "type": "Private",
    "name": "Drexel University"
   }
  },
  {
   "name": "Duke University",
   "deferral": "yes",
   "how": "Request an independent gap year in the Duke Applicant Portal, starting in March. You can also apply to Duke's own Gap Year Program.",
   "deadline": null,
   "deadlineDate": null,
   "length": "One year (two, case by case, usually for military or religious service)",
   "deposit": null,
   "creditLevel": "limited",
   "credit": "You can't enroll full time or as a degree-seeking student elsewhere. Part-time, non-degree courses are allowed but may not transfer.",
   "israel": "Two-year deferrals are considered for religious service.",
   "noApplyingElsewhere": true,
   "source": "https://admissions.duke.edu/gapyear/",
   "quote": "Admitted students who choose Duke can request to defer their enrollment for one year",
   "hillel": {
    "rank": 84,
    "jewish": 886,
    "type": "Private",
    "name": "Duke University"
   }
  },
  {
   "name": "Yale University",
   "deferral": "yes",
   "how": "Send Yale a brief statement of your plans for the year through the offer-reply process; it must be approved.",
   "deadline": null,
   "deadlineDate": null,
   "length": "One year; two-year requests considered case by case.",
   "deposit": null,
   "creditLevel": "limited",
   "credit": "No guarantee gap-year courses will be accepted; outside college work may count on a department's recommendation, and enrolled students can apply up to two course credits from another college.",
   "grades": "You must finish senior year satisfactorily and maintain good conduct during the gap year.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://apps.admissions.yale.edu/register/?id=dc96b27b-af00-417a-bebb-742e2492e61a",
   "quote": "If you request postponed matriculation we will ask that you provide us with a brief statement about your plans for the upcoming year, which will need to be approved.",
   "hillel": {
    "rank": 88,
    "jewish": 800,
    "type": "Private",
    "name": "Yale University"
   }
  },
  {
   "name": "University of Chicago",
   "deferral": "case",
   "how": "Accept your offer and pay the enrollment fee, then apply through your regional admissions counselor. Approval comes in writing from the Dean of Admissions.",
   "deadline": "Before June 15",
   "deadlineDate": "2027-06-15",
   "length": "One year",
   "deposit": true,
   "creditLevel": "unclear",
   "credit": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://collegeadmissions.uchicago.edu/apply/uchicago-admissions-faq/",
   "quote": "UChicago will consider requests to take a one-year gap year from incoming first-year students before June 15.",
   "hillel": {
    "rank": 89,
    "jewish": 800,
    "type": "Private",
    "name": "University of Chicago"
   }
  },
  {
   "name": "Oberlin College",
   "deferral": "case",
   "how": "First confirm enrollment and submit the enrollment deposit; then submit the Gap Year Deferral Request form. If approved, sign the deferral contract and submit the $1,000 enrollment deposit within two weeks.",
   "deadline": "June 1",
   "deadlineDate": "2027-06-01",
   "length": "One academic year",
   "deposit": true,
   "creditLevel": "limited",
   "credit": "During deferment, students may take up to two full courses per semester (maximum four courses in one year) at another accredited institution; full-time enrollment is not permitted. Gap-year courses count toward the first-year 20 pre-matriculation-credit limit.",
   "grades": "Merit scholarships are honored provided the student remains in good academic and disciplinary standing during the deferral period.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://www.oberlin.edu/admissions-and-aid/for-accepted-students/gap-year-requests",
   "quote": "Enrolling students may request to have their matriculation deferred for one academic year.",
   "hillel": {
    "rank": 90,
    "jewish": 650,
    "type": "Private",
    "name": "Oberlin College"
   }
  },
  {
   "name": "Case Western Reserve University",
   "deferral": "case",
   "how": "Submit the Gap Year or Semester request form; if the committee approves, sign the Gap Agreement.",
   "deadline": "July 1",
   "deadlineDate": "2027-07-01",
   "length": "One gap year or semester.",
   "deposit": null,
   "creditLevel": "limited",
   "credit": "Non-degree courses allowed with pre-approval (up to 8 credits a semester without it); send the transcript.",
   "grades": "Need a 3.0 cumulative GPA in those courses with no grade below C.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://case.edu/admission/admitted-students/gap-year",
   "quote": null,
   "hillel": {
    "rank": 91,
    "jewish": 630,
    "type": "Private",
    "name": "Case Western Reserve University"
   }
  },
  {
   "name": "Stanford University",
   "deferral": "case",
   "how": "Complete or update the Admission Response form in the Stanford Portal, provide a clear gap-year plan, and if approved sign the Stanford Gap Year Contract.",
   "deadline": null,
   "deadlineDate": null,
   "length": "Usually one year; two-year deferrals are granted for national military service or a religious mission.",
   "deposit": null,
   "creditLevel": "limited",
   "credit": "Students who defer sign a contract not to enroll full-time at any other college or university while holding a deferred place.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://admit.stanford.edu/next-steps/accept/defer-enrollment",
   "quote": "All students who defer their enrollment will be asked to sign a contract, stating that they will not apply to, hold a place at, or enroll full-time in any other college or university while holding a deferred place at Stanford University.",
   "hillel": {
    "rank": 94,
    "jewish": 600,
    "type": "Private",
    "name": "Stanford University"
   }
  },
  {
   "name": "Chapman University",
   "deferral": "case",
   "how": "Contact your admission counselor; the Admission Committee reviews the request.",
   "deadline": null,
   "deadlineDate": null,
   "length": "One semester or academic year.",
   "deposit": true,
   "creditLevel": "none",
   "credit": "You may not take coursework at another institution during the deferral.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://www.chapman.edu/admission/undergraduate/admitted-students/deferment-interrupted-enrollment.aspx",
   "quote": null,
   "hillel": {
    "rank": 95,
    "jewish": 550,
    "type": "Private",
    "name": "Chapman University"
   }
  },
  {
   "name": "Clark University",
   "deferral": "yes",
   "how": "Complete the Enrollment Reply Form and pay the deposit, then request a deferral.",
   "deadline": null,
   "deadlineDate": null,
   "length": null,
   "deposit": true,
   "creditLevel": "unclear",
   "credit": "Clark doesn't state a deferral-specific rule; in general, eligible college work done before enrolling can count with a C or better.",
   "grades": "Prior college work with a C or better may count for credit.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.clarku.edu/undergraduate-admissions/deposit/",
   "quote": "To defer, you must first complete the Enrollment Reply Form and submit your deposit.",
   "hillel": {
    "rank": 96,
    "jewish": 500,
    "type": "Private",
    "name": "Clark University"
   }
  },
  {
   "name": "Skidmore College",
   "deferral": "yes",
   "how": "Email deanofadmissions@skidmore.edu.",
   "deadline": "May 15",
   "deadlineDate": "2027-05-15",
   "length": "One year",
   "deposit": null,
   "creditLevel": "unclear",
   "credit": null,
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.skidmore.edu/admissions/faqs.php",
   "quote": "If you've decided to enrich your education with a gap year experience, you can request a one-year deferral by emailing deanofadmissions@skidmore.edu by May 15.",
   "hillel": {
    "rank": 97,
    "jewish": 500,
    "type": "Private",
    "name": "Skidmore College"
   }
  },
  {
   "name": "University of Denver",
   "deferral": "yes",
   "how": "Complete the deferral form in the applicant portal with your plans and confirm you won't enroll elsewhere.",
   "deadline": "May 1 (response and $500 deposit for non-binding admits).",
   "deadlineDate": "2027-05-01",
   "length": "Not stated (a post-graduate year isn't eligible).",
   "deposit": true,
   "creditLevel": "none",
   "credit": "No college-level courses elsewhere; taking them means reapplying as a transfer.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://www.du.edu/admission-aid/undergraduate-admission/faq",
   "quote": null,
   "hillel": {
    "rank": 99,
    "jewish": 500,
    "type": "Private",
    "name": "University of Denver"
   }
  },
  {
   "name": "Southern Methodist University",
   "deferral": "case",
   "how": "Request a Gap Year or Gap Semester as an admitted student; requests are reviewed individually and aren't guaranteed.",
   "deadline": null,
   "deadlineDate": null,
   "length": "One gap year or gap semester, if approved.",
   "deposit": null,
   "creditLevel": "none",
   "credit": "You may not take college courses for credit elsewhere during the gap; doing so means reapplying as a transfer student.",
   "grades": null,
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://www.smu.edu/admission/apply/undergraduate-admission/gap-year",
   "quote": "Students approved for deferred enrollment may not take college courses for credit at another institution",
   "hillel": {
    "rank": 100,
    "jewish": 500,
    "type": "Private",
    "name": "Southern Methodist University"
   }
  },
  {
   "name": "Princeton University",
   "deferral": "yes",
   "how": "After deciding to enroll, request a deferral from the Office of Admission.",
   "deadline": "Before May 15",
   "deadlineDate": "2027-05-15",
   "length": "One year (sometimes an additional year)",
   "deposit": null,
   "creditLevel": "limited",
   "credit": "You may not enroll full time in a degree program at another institution during the deferral.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://admission.princeton.edu/faqs?page=13",
   "quote": "If you pursue this, you may not enroll full time in a degree program at another institution during the deferral period.",
   "hillel": null
  },
  {
   "name": "Dartmouth College",
   "deferral": "yes",
   "how": "Confirm your intent to enroll by May 1, then email the Assistant to the Dean of Admissions and Financial Aid with your reasons and plans.",
   "deadline": "June 1",
   "deadlineDate": "2027-06-01",
   "length": "One year (two for obligatory national/military service)",
   "deposit": null,
   "creditLevel": "unclear",
   "credit": "Dartmouth says students may take courses they couldn't take in high school, but doesn't spell out a college-credit rule.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://admissions.dartmouth.edu/apply-dartmouth/gap-year",
   "quote": "Admitted students who postpone their enrollment may not apply to any other colleges or universities during their gap year.",
   "hillel": null
  },
  {
   "name": "Johns Hopkins University",
   "deferral": "case",
   "how": "Submit the Reply Form and enrollment deposit in the applicant portal, then complete the deferral request form.",
   "deadline": null,
   "deadlineDate": null,
   "length": "One or two years (you start in the fall when you return)",
   "deposit": null,
   "creditLevel": "none",
   "credit": "You may not study at another institution for credit during the deferral.",
   "israel": null,
   "noApplyingElsewhere": null,
   "source": "https://apply.jhu.edu/frequently-asked-questions/",
   "quote": "Deferrals are granted on an individual basis and are not guaranteed.",
   "hillel": null
  },
  {
   "name": "MIT",
   "deferral": "yes",
   "how": "After confirming you'll enroll, send a formal deferral request to the Dean of Admissions.",
   "deadline": null,
   "deadlineDate": null,
   "length": "One or two years",
   "deposit": null,
   "creditLevel": "none",
   "credit": "You may not defer in order to take courses at another college or university.",
   "israel": null,
   "noApplyingElsewhere": true,
   "source": "https://mitadmissions.org/help/faq/deferred-enrollment/",
   "quote": "If you're admitted to MIT, you may defer enrollment for one or two years.",
   "hillel": null
  }
 ],
 "notFound": [
  {
   "name": "University of California, Davis",
   "hillel": {
    "rank": 33,
    "jewish": 2500,
    "type": "Public",
    "name": "University of California, Davis"
   }
  },
  {
   "name": "Queensborough Community College",
   "hillel": {
    "rank": 39,
    "jewish": 2000,
    "type": "Public",
    "name": "Queensborough Community College"
   }
  },
  {
   "name": "University at Albany",
   "hillel": {
    "rank": 49,
    "jewish": 1500,
    "type": "Public",
    "name": "University at Albany"
   }
  },
  {
   "name": "University of Kansas",
   "hillel": {
    "rank": 65,
    "jewish": 1300,
    "type": "Public",
    "name": "University of Kansas"
   }
  },
  {
   "name": "SUNY Rockland Community College",
   "hillel": {
    "rank": 81,
    "jewish": 1000,
    "type": "Public",
    "name": "SUNY Rockland Community College"
   }
  },
  {
   "name": "Hofstra University",
   "hillel": {
    "rank": 86,
    "jewish": 850,
    "type": "Private",
    "name": "Hofstra University"
   }
  },
  {
   "name": "Queens College",
   "hillel": {
    "rank": 8,
    "jewish": 4000,
    "type": "Public",
    "name": "Queens College"
   }
  },
  {
   "name": "Florida International University",
   "hillel": {
    "rank": 15,
    "jewish": 3500,
    "type": "Public",
    "name": "Florida International University"
   }
  },
  {
   "name": "University of Illinois at Urbana-Champaign",
   "hillel": {
    "rank": 19,
    "jewish": 3250,
    "type": "Public",
    "name": "University of Illinois at Urbana-Champaign"
   }
  },
  {
   "name": "University of Vermont",
   "hillel": {
    "rank": 29,
    "jewish": 2500,
    "type": "Public",
    "name": "University of Vermont"
   }
  },
  {
   "name": "Los Angeles Pierce College, Woodland Hills",
   "hillel": {
    "rank": 40,
    "jewish": 2000,
    "type": "Public",
    "name": "Los Angeles Pierce College, Woodland Hills"
   }
  },
  {
   "name": "California Polytechnic State University, San Luis Obispo",
   "hillel": {
    "rank": 54,
    "jewish": 1500,
    "type": "Public",
    "name": "California Polytechnic State University, San Luis Obispo"
   }
  },
  {
   "name": "Concordia University, Sir George and Loyola Campus",
   "hillel": {
    "rank": 71,
    "jewish": 1200,
    "type": "Public",
    "name": "Concordia University, Sir George and Loyola Campus"
   }
  },
  {
   "name": "Elon University",
   "hillel": {
    "rank": 87,
    "jewish": 800,
    "type": "Private",
    "name": "Elon University"
   }
  },
  {
   "name": "University of Hartford",
   "hillel": {
    "rank": 92,
    "jewish": 600,
    "type": "Private",
    "name": "University of Hartford"
   }
  },
  {
   "name": "University of Central Florida",
   "hillel": {
    "rank": 3,
    "jewish": 6300,
    "type": "Public",
    "name": "University of Central Florida"
   }
  },
  {
   "name": "University of California, Santa Barbara",
   "hillel": {
    "rank": 20,
    "jewish": 3000,
    "type": "Public",
    "name": "University of California, Santa Barbara"
   }
  },
  {
   "name": "Hunter College",
   "hillel": {
    "rank": 51,
    "jewish": 1500,
    "type": "Public",
    "name": "Hunter College"
   }
  },
  {
   "name": "San Francisco State University",
   "hillel": {
    "rank": 55,
    "jewish": 1500,
    "type": "Public",
    "name": "San Francisco State University"
   }
  },
  {
   "name": "Emerson College",
   "hillel": {
    "rank": 93,
    "jewish": 600,
    "type": "Private",
    "name": "Emerson College"
   }
  },
  {
   "name": "California State University, Northridge",
   "hillel": {
    "rank": 21,
    "jewish": 3000,
    "type": "Public",
    "name": "California State University, Northridge"
   }
  },
  {
   "name": "University of Delaware",
   "hillel": {
    "rank": 38,
    "jewish": 2350,
    "type": "Public",
    "name": "University of Delaware"
   }
  },
  {
   "name": "Towson University",
   "hillel": {
    "rank": 47,
    "jewish": 1700,
    "type": "Public",
    "name": "Towson University"
   }
  },
  {
   "name": "University at Buffalo",
   "hillel": {
    "rank": 52,
    "jewish": 1500,
    "type": "Public",
    "name": "University at Buffalo"
   }
  },
  {
   "name": "Queen's University",
   "hillel": {
    "rank": 56,
    "jewish": 1500,
    "type": "Public",
    "name": "Queen's University"
   }
  },
  {
   "name": "University of South Florida",
   "hillel": {
    "rank": 73,
    "jewish": 1200,
    "type": "Public",
    "name": "University of South Florida"
   }
  },
  {
   "name": "Barnard College",
   "hillel": {
    "rank": 85,
    "jewish": 850,
    "type": "Private",
    "name": "Barnard College"
   }
  },
  {
   "name": "Pace University",
   "hillel": {
    "rank": 98,
    "jewish": 500,
    "type": "Private",
    "name": "Pace University"
   }
  },
  {
   "name": "Harvard College",
   "hillel": null
  },
  {
   "name": "Wesleyan University",
   "hillel": null
  },
  {
   "name": "Yeshiva University",
   "hillel": null
  }
 ]
};
